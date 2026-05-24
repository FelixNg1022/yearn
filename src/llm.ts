// src/llm.ts
import OpenAI from "openai";
import type { Lang, ReadingRow, UserRow } from "./db.ts";
import { config } from "./config.ts";

const MODEL = "openrouter/free";
const BASE_URL = "https://openrouter.ai/api/v1";

const SYSTEM_PROMPT = `You are 运 (yùn), a Gen Z fortune oracle on iMessage. You interpret ancient Chinese divination casts — the hexagrams and palaces are computed for you, your job is to read them.

Vibe rules:
- Write like a supportive bestie who genuinely knows the cosmos. Warm, direct, a little mystical. Use Gen Z language naturally — "lowkey", "the cast is giving", "no cap", "it's serving", "main character energy", "understood the assignment", "the universe said" — but keep it organic, not forced.
- Respond in the user's language (en or zh). For zh: keep it natural and fun, not stiff.
- THREE short punchy paragraphs only:
  1. What the hexagram/palace is literally saying about their situation. Name it. Be specific about the cast.
  2. How their 八字 day master and element energy shifts the reading. Specific, not vague.
  3. One concrete thing to do or watch for in the next few days. Commit. No hedging.
- Never say "it depends" or "consider possibly" — the stars said what they said, period.
- Never add disclaimers. The cosmos is speaking. Take it seriously.
- If it's not a real life/vibe question (e.g. "what's 2+2"), let them know you only read actual situations — then invite them to try again cutely.
- Under 180 words. No markdown. Plain iMessage text.`;

export interface InterpretInput {
  question: string;
  lang: Lang;
  kernel: unknown;
  user: UserRow;
  recent: ReadingRow[];
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

export type LuckyColorName = "orange" | "marigold" | "rose" | "magenta" | "violet" | "azure" | "teal" | "lime";
export type LuckyStone = "emerald" | "ruby" | "sapphire";

export interface LuckyAttributes {
  number: number;       // 1-9
  color: LuckyColorName;
  stone: LuckyStone;
}

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
   * Given the cast and user's bazi, produce daily scores and guidance.
   */
  getDailyScores(question: string, cast: unknown, user: UserRow): Promise<DailyScores>;
  /**
   * Given user's 八字 pillars, derive lucky number, color, and stone.
   * Called once at onboarding completion.
   */
  getLuckyAttributes(bazi: unknown, lang: Lang): Promise<LuckyAttributes>;
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
        `Classify a divination question as "specific" (asks about probability/likelihood of a concrete event) or "general" (seeks guidance on a situation/decision). Output strict JSON only — no prose, no markdown — with shape:
{"type":"general"|"specific","probability":<0-100>|null}
probability: estimated percentage chance for specific questions based on question framing, null for general questions. Output JSON only.`,
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

    async getDailyScores(question, cast, user) {
      const bazi = user.bazi_pillars ? JSON.parse(user.bazi_pillars) : null;
      const userPrompt = [
        `QUESTION: ${question}`,
        "",
        "CAST:",
        JSON.stringify(cast, null, 2),
        "",
        "USER 八字:",
        bazi ? JSON.stringify(bazi, null, 2) : "(not set)",
        "",
        `Given the divination cast and user's 八字, produce today's daily scores. Use fun, Gen Z-flavored phrasing for avoid (think: "starting drama in the group chat", "saying yes to everything"). Output strict JSON only:
{"avoid":"<≤8 words of what to avoid today>","relationship":<1-5>,"academic":<1-5>,"career":<1-5>,"general":<1-5>}
Output JSON only. No code fences. No commentary.`,
      ].join("\n");

      const fallback = { avoid: "overcommitting", relationship: 3, academic: 3, career: 3, general: 3 };
      const text = await chat("You produce daily divination scores in JSON format. Output JSON only.", userPrompt, 200);
      const parsed = parseJson<Record<string, unknown>>(text);
      if (!parsed) return fallback;
      const clamp = (v: unknown): number => Math.max(1, Math.min(5, Math.round(typeof v === "number" ? v : 3)));
      return {
        avoid: typeof parsed.avoid === "string" ? parsed.avoid : fallback.avoid,
        relationship: clamp(parsed.relationship),
        academic: clamp(parsed.academic),
        career: clamp(parsed.career),
        general: clamp(parsed.general),
      };
    },

    async getLuckyAttributes(bazi, lang) {
      const VALID_COLORS = ["orange", "marigold", "rose", "magenta", "violet", "azure", "teal", "lime"] as const;
      const VALID_STONES = ["emerald", "ruby", "sapphire"] as const;
      const fallback = { number: 7, color: "violet" as const, stone: "amethyst" as unknown as "sapphire" };
      const text = await chat(
        `Given a user's 八字 pillars, derive their lucky attributes based on their day master element and favorable elements.
Color must be one of exactly: orange, marigold, rose, magenta, violet, azure, teal, lime.
Stone must be one of exactly: emerald, ruby, sapphire.
Output strict JSON only:
{"number":<1-9>,"color":"<one of the 8 color names>","stone":"<emerald|ruby|sapphire>"}
Output JSON only. No code fences. No commentary.`,
        `八字: ${JSON.stringify(bazi)}\nLang: ${lang}\n\nReturn JSON.`,
        60,
      );
      const parsed = parseJson<Record<string, unknown>>(text);
      if (!parsed) return fallback;
      const rawColor = (typeof parsed.color === "string" ? parsed.color.toLowerCase() : "") as typeof VALID_COLORS[number];
      const rawStone = (typeof parsed.stone === "string" ? parsed.stone.toLowerCase() : "") as typeof VALID_STONES[number];
      return {
        number: typeof parsed.number === "number" ? Math.max(1, Math.min(9, Math.round(parsed.number))) : fallback.number,
        color: VALID_COLORS.includes(rawColor) ? rawColor : "violet",
        stone: VALID_STONES.includes(rawStone) ? rawStone : "sapphire",
      };
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
        `Respond in ${lang === "zh" ? "中文" : "English"}. Be specific. Commit to a reading. Keep the Gen Z bestie energy. Don't repeat phrasing from past readings.`,
      ].join("\n");

      const text = await chat(SYSTEM_PROMPT, userPrompt, 600);
      if (!text) throw new Error("OpenRouter response missing text");
      return text;
    },
  };
}
