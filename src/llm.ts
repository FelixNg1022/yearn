// src/llm.ts
import OpenAI from "openai";
import type { Lang, ReadingRow, UserRow } from "./db.ts";
import { config } from "./config.ts";

const MODEL = "deepseek/deepseek-v4-flash";
const BASE_URL = "https://openrouter.ai/api/v1";

const SYSTEM_PROMPT = `You are 运 (yùn), a Gen Z fortune oracle on iMessage. You read divination casts — hexagrams/palaces are computed for you.

Vibe rules:
- 2–4 sentences MAX. Punchy bestie energy — lowkey, direct, a little mystical. No essays.
- Sentence 1: what the cast says about their question (name the hexagram/palace).
- Sentence 2: how their 八字 day master colors it (one concrete detail).
- Sentence 3 (optional): one thing to do or watch for soon. Commit — no hedging.
- Under 70 words total. No markdown. Plain iMessage text.
- Respond in the user's language (en or zh).
- If they ask something silly (e.g. "what's 2+2"), say you only read real life questions — keep it cute and brief.`;

export interface InterpretInput {
  question: string;
  lang: Lang;
  kernel: unknown;
  user: UserRow;
  recent: ReadingRow[];
  /** When set, weave this % into a specific-outcome reading. */
  probability?: number | null;
}

export interface QuestionClassification {
  type: "general" | "specific";
  probability: number | null;  // 0-100, only for "specific" type
}

export interface DailyScores {
  avoid: string;        // short phrase (≤8 words) of what to avoid today
  relationship: number; // 1-5
  academic: number;     // 1-5
  career: number;       // 1-5
  general: number;      // 1-5
}

export interface DailyScoresInput {
  at: Date;
  tzOffset: string;
  cast: unknown;
  bazi: BaziResult;
  luck: DailyLuckScores;
  lang: Lang;
}

export type LuckyColorName = "orange" | "marigold" | "rose" | "magenta" | "violet" | "azure" | "teal" | "lime";

import { deriveCoreLuckyAttributes, deriveProfileStatsFallback, type LuckyAttributes } from "./card/luckyAttributes.ts";
import type { BaziResult } from "./kernel/bazi.ts";
import type { DailyLuckScores } from "./kernel/dailyLuck.ts";
import { localCalendarParts } from "./kernel/dailyLuck.ts";

export type { LuckyAttributes };

export interface LlmClient {
  interpret(input: InterpretInput): Promise<string>;
  /**
   * Extract the number of days from "now" to the event the user is asking
   * about. Returns null when the question has no clear time horizon
   * (e.g. "will I get the job?"). Implementations should be cheap — this
   * runs on every reading before the main interpret() call.
   */
  extractHorizonDays(question: string, lang: Lang): Promise<number | null>;
  /**
   * Classify a divination question as "general" (seeks guidance) or
   * "specific" (asks about probability of a concrete event).
   * For specific questions, also estimates the probability (0-100).
   */
  classifyQuestion(question: string, lang: Lang): Promise<QuestionClassification>;
  /**
   * Given kernel-computed luck scores and the day's cast, produce the avoid phrase.
   * Luck meters (1–5) come from computeDailyLuck(); the LLM only writes avoid text.
   */
  getDailyScores(input: DailyScoresInput): Promise<DailyScores>;
  /**
   * Given user's 八字 pillars, derive lucky number, color, and stone.
   * Called once at onboarding completion.
   */
  getLuckyAttributes(bazi: unknown, lang: Lang): Promise<LuckyAttributes>;
  /** LLM-read 八字 for personalized millionaire % and meet-love age. */
  getProfileStats(input: { bazi: unknown; name: string | null; lang: Lang }): Promise<{ millionaireChance: number; meetLoveAge: number }>;
  /** One- or two-sentence broad fortune blurb for the profile card projection box. */
  getProfileProjection(input: { bazi: unknown; name: string | null; lang: Lang }): Promise<string>;
  /**
   * Resolve a free-text location (city name, abbreviation, region) to a
   * UTC offset string like "+08:00". Returns null if unrecognisable.
   * Called once during onboarding as a fallback after the static TZ_MAP misses.
   */
  resolveTimezone(location: string): Promise<string | null>;
}

const HORIZON_SYSTEM_PROMPT = `You extract the prediction horizon from a divination question.

Output strict JSON only — no prose, no markdown — with shape:
  {"horizon_days": <integer 0..30> | null}

Rules:
- horizon_days is the number of days from today until the event the user is asking about.
- "today/tonight" → 0. "tomorrow" → 1. "this weekend" → 2-5 (closest weekend day).
- "next week" → 7. "in a month" → 30. "in 3 days" → 3. "in 2 weeks" → 14.
- If the question has no clear time horizon (open-ended like "will I get the job?"), return null.
- Clamp anything beyond 30 days to 30. Never return negative numbers.
- Output JSON only. No code fences. No commentary.`;

function parseJson<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

const AVOID_BY_AREA = {
  en: {
    general: "forcing the vibe",
    relationship: "mixed signals",
    academic: "last-minute cramming",
    career: "overcommitting",
  },
  zh: {
    general: "硬撑状态",
    relationship: "暧昧拉扯",
    academic: "临时抱佛脚",
    career: "过度揽活",
  },
} as const;

function fallbackDailyAvoid(
  scores: Pick<DailyScores, "general" | "relationship" | "academic" | "career">,
  lang: Lang,
): string {
  const table = AVOID_BY_AREA[lang];
  const entries = [
    ["general", scores.general],
    ["relationship", scores.relationship],
    ["academic", scores.academic],
    ["career", scores.career],
  ] as const;
  const weakest = entries.reduce((min, cur) => (cur[1] < min[1] ? cur : min));
  return table[weakest[0]];
}

export function createLlm(): LlmClient {
  const client = new OpenAI({
    apiKey: config.openRouterApiKey(),
    baseURL: BASE_URL,
  });

  async function chat(system: string, user: string, maxTokens: number): Promise<string> {
    const res = await client.chat.completions.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }

  return {
    async extractHorizonDays(question, lang) {
      const text = await chat(
        HORIZON_SYSTEM_PROMPT,
        `QUESTION (${lang}): ${question}\n\nReturn JSON.`,
        40,
      );
      const parsed = parseJson<{ horizon_days: unknown }>(text);
      if (!parsed) return null;
      const h = parsed.horizon_days;
      if (h === null) return null;
      if (typeof h !== "number" || !Number.isFinite(h)) return null;
      return Math.round(Math.max(0, Math.min(30, h)));
    },

    async classifyQuestion(question, lang) {
      const text = await chat(
        `Classify a divination question as "specific" (asks about probability/likelihood/outcome of a concrete future event — e.g. will I get the job, net worth, will we date) or "general" (seeks guidance, vibes, or open-ended advice). Output strict JSON only — no prose, no markdown — with shape:
{"type":"general"|"specific","probability":<0-100>|null}
probability: estimated percentage for specific questions based on question framing; null for general. Output JSON only.`,
        `QUESTION (${lang}): ${question}\n\nReturn JSON.`,
        60,
      );
      const parsed = parseJson<{ type: unknown; probability: unknown }>(text);
      if (!parsed) return { type: "general", probability: null };
      const type = parsed.type === "specific" ? "specific" : "general";
      const probability = typeof parsed.probability === "number" && Number.isFinite(parsed.probability)
        ? Math.max(0, Math.min(100, Math.round(parsed.probability)))
        : null;
      return { type, probability };
    },

    async getDailyScores({ at, tzOffset, cast, bazi, luck, lang }) {
      const cal = localCalendarParts(at, tzOffset);
      const dateLabel = `${cal.year}-${String(cal.month).padStart(2, "0")}-${String(cal.day).padStart(2, "0")}`;
      const scores = {
        general: luck.general,
        relationship: luck.relationship,
        academic: luck.academic,
        career: luck.career,
      };

      const userPrompt = [
        `CALENDAR DAY (${tzOffset}): ${dateLabel}`,
        `流日: ${luck.flow.day_pillar.gan_zhi} · 流月: ${luck.flow.month_pillar.gan_zhi}`,
        "",
        "PRE-COMPUTED LUCK SCORES (1–5, do NOT change these):",
        JSON.stringify(scores),
        "",
        "CAST:",
        JSON.stringify(cast, null, 2),
        "",
        "USER 八字:",
        JSON.stringify(bazi, null, 2),
        "",
        `Write one short Gen-Z "try to avoid…" phrase (≤8 words, ${lang}) grounded in today's 流日 vs their 日主 (${bazi.day_master}/${bazi.day_master_element}) and the weakest luck area.`,
        `Output strict JSON only: {"avoid":"<≤8 words>"}`,
      ].join("\n");

      const fallbackAvoid = fallbackDailyAvoid(scores, lang);
      const text = await chat(
        "You write a single daily avoid phrase in JSON. Luck scores are already computed — never output or change them.",
        userPrompt,
        120,
      );
      const parsed = parseJson<{ avoid?: unknown }>(text);
      const avoid = typeof parsed?.avoid === "string" && parsed.avoid.trim()
        ? parsed.avoid.trim()
        : fallbackAvoid;

      return { avoid, ...scores };
    },

    async getLuckyAttributes(bazi, _lang) {
      const core = deriveCoreLuckyAttributes(bazi);
      const stats = deriveProfileStatsFallback(bazi);
      return { ...core, ...stats };
    },

    async getProfileStats({ bazi, name, lang }) {
      const fallback = deriveProfileStatsFallback(bazi);

      const text = await chat(
        `You are a 八字 (Four Pillars of Destiny) reader estimating two playful profile-card stats.
Read the full chart: day master (日主), element balance, wealth star (财星), resource stars (印星), and spouse/peach blossom (桃花) indicators.

millionaireChance: integer 0-100 — this user's personalized probability of becoming a millionaire.
- Strong 财星, supportive day master, and good wealth cycles → higher (often 55-92).
- Weak or clashed wealth indicators → lower (often 18-54).
- Each unique chart must get a distinct, justified value. Never copy a default like 72 or 50.

meetLoveAge: integer 18-45 — age they'll meet their romantic partner.
- Base on spouse palace, 桃花 stars, and element harmony in the chart.
- Personalize per chart; avoid clustering everyone at the same age.

Output strict JSON only:
{"millionaireChance":<0-100>,"meetLoveAge":<18-45>}
No code fences. No commentary.`,
        [
          `USER: ${name ?? "friend"}`,
          `八字: ${JSON.stringify(bazi)}`,
          `Lang: ${lang}`,
          "",
          "Analyze this specific chart and return JSON with both fields.",
        ].join("\n"),
        80,
      );

      const parsed = parseJson<{ millionaireChance?: unknown; meetLoveAge?: unknown }>(text);
      if (!parsed) return fallback;

      const clampPct = (v: unknown, fb: number) =>
        typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : fb;
      const clampAge = (v: unknown, fb: number) =>
        typeof v === "number" && Number.isFinite(v) ? Math.max(18, Math.min(45, Math.round(v))) : fb;

      return {
        millionaireChance: clampPct(parsed.millionaireChance, fallback.millionaireChance),
        meetLoveAge: clampAge(parsed.meetLoveAge, fallback.meetLoveAge),
      };
    },

    async getProfileProjection({ bazi, name, lang }) {
      const limit = lang === "zh" ? 85 : 115;
      const text = await chat(
        `You write ultra-short fortune projections for a small profile card.
Hard limit: ${limit} characters including spaces — never exceed this.
Output 1–2 short sentences only. Gen Z bestie tone but concise, like a fortune cookie.
Reference the user's 八字 day master or element if it fits naturally.
No markdown, no emoji, no line breaks. Plain text only.`,
        [
          `USER: ${name ?? "friend"}`,
          `八字: ${JSON.stringify(bazi)}`,
          `Lang: ${lang}`,
          "",
          `Write the projection in ${lang === "zh" ? "中文" : "English"}. Under ${limit} chars.`,
        ].join("\n"),
        60,
      );
      return text.trim();
    },

    async resolveTimezone(location) {
      const text = await chat(
        `You resolve a location to its standard UTC offset.
Output strict JSON only — no prose, no markdown:
  {"utc_offset": "+HH:MM" | null}
Rules:
- Return the UTC offset for the location's standard/winter time (e.g. "LA" → "-08:00", "Shanghai" → "+08:00").
- If the location is completely unrecognisable, return null.
- Output JSON only. No code fences. No commentary.`,
        `LOCATION: ${location}\n\nReturn JSON.`,
        20,
      );
      const parsed = parseJson<{ utc_offset: unknown }>(text);
      if (!parsed) return null;
      const offset = parsed.utc_offset;
      if (typeof offset !== "string") return null;
      if (!/^[+-]\d{2}:\d{2}$/.test(offset)) return null;
      return offset;
    },

    async interpret(input) {
      const { question, lang, kernel, user, recent } = input;
      const bazi = user.bazi_pillars ? JSON.parse(user.bazi_pillars) : null;
      const recentBlock = recent.length
        ? recent.slice(0, 5).map((r, i) => {
            const date = new Date(r.created_at).toISOString().slice(0, 10);
            const outcomeStr = r.outcome ? ` → outcome: ${r.outcome}${r.user_note ? ` (${r.user_note})` : ""}` : " → outcome: pending";
            return [
              `  ${i + 1}. [${date}] Q: "${r.question.slice(0, 80)}"`,
              `      reply: "${r.interpretation.slice(0, 120)}"${outcomeStr}`,
            ].join("\n");
          }).join("\n")
        : "  (none)";

      const userPrompt = [
        `USER: ${user.name ?? "unknown"}`,
        `QUESTION: ${question}`,
        "",
        "CAST (deterministic kernel output):",
        JSON.stringify(kernel, null, 2),
        "",
        "USER 八字 CONTEXT:",
        bazi ? JSON.stringify(bazi, null, 2) : "  (not set — no hour pillar)",
        "",
        "PAST READINGS (last 5, with what you said before and how it played out):",
        recentBlock,
        "",
        `Respond in ${lang === "zh" ? "中文" : "English"}. Be specific. Keep it SHORT. Gen Z bestie energy. Don't repeat phrasing from past readings.`,
        input.probability != null
          ? `Estimated probability from the cast: ${input.probability}%. Mention it naturally in your reading.`
          : "",
      ].filter(Boolean).join("\n");

      const text = await chat(SYSTEM_PROMPT, userPrompt, 180);
      if (!text) {
        // Model returned empty — common for very short/ambiguous inputs. Return a soft fallback.
        return lang === "zh"
          ? "宇宙今天有点安静，换个问题试试吧 ✨"
          : "the universe went quiet on that one ✨ try rephrasing or ask something else!";
      }
      return text;
    },
  };
}
