// src/llm.ts
import Anthropic from "@anthropic-ai/sdk";
import type { Lang, ReadingRow, UserRow } from "./db.ts";
import { config } from "./config.ts";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are 运 (yùn), an iMessage oracle. You do NOT generate hexagrams or palaces — they are computed deterministically from the timestamp of the user's message and handed to you. Your job is to interpret.

Rules:
- Respond in the user's language (en or zh). Match their register — casual iMessage, not formal.
- Answer in THREE short paragraphs, no more:
  1. What the cast literally says about their question. Anchor in the hexagram/palace name and the changing line (if one).
  2. How their 八字 modulates it. Day master, element balance, relevant pillar interactions. Be specific, not generic.
  3. One concrete action or watchpoint for the next 3–7 days. Commit.
- Never hedge into uselessness. No "it depends," no "consider possibly." Take a read. Say it.
- Never add disclaimers like "this is just for fun" or "for entertainment only." The whole point is taking the question seriously.
- If the question is obviously not a divination question (e.g. "what's 2+2"), reply briefly that you only read questions about intentions, decisions, and situations — then invite them to try again.
- Keep the reply under 180 words. No markdown headers. Plain text suitable for iMessage.`;

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
  luck: string;         // short phrase (≤8 words) for luck of the day
  relationship: number; // 1-5
  academic: number;     // 1-5
  career: number;       // 1-5
  general: number;      // 1-5
}

export interface LuckyAttributes {
  number: number;   // 1-9
  color: string;    // e.g. "Red"
  colorHex: string; // e.g. "#C0392B"
  stone: string;    // e.g. "Ruby"
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

export function createLlm(): LlmClient {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey() });

  return {
    async extractHorizonDays(question, lang) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 40,
        system: HORIZON_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `QUESTION (${lang}): ${question}\n\nReturn JSON.` },
        ],
      });
      const block = res.content.find((c) => c.type === "text");
      if (!block || block.type !== "text") return null;
      try {
        // Tolerate occasional fence drift even though we told it not to.
        const cleaned = block.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as { horizon_days: unknown };
        const h = parsed.horizon_days;
        if (h === null) return null;
        if (typeof h !== "number" || !Number.isFinite(h)) return null;
        if (h < 0) return 0;
        if (h > 30) return 30;
        return Math.round(h);
      } catch {
        return null;
      }
    },

    async classifyQuestion(question, lang) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 60,
        system: `Classify a divination question as "specific" (asks about probability/likelihood of a concrete event) or "general" (seeks guidance on a situation/decision). Output strict JSON only — no prose, no markdown — with shape:
{"type":"general"|"specific","probability":<0-100>|null}
probability: estimated percentage chance for specific questions based on question framing, null for general questions. Output JSON only.`,
        messages: [
          { role: "user", content: `QUESTION (${lang}): ${question}\n\nReturn JSON.` },
        ],
      });
      const block = res.content.find((c) => c.type === "text");
      if (!block || block.type !== "text") return { type: "general", probability: null };
      try {
        const cleaned = block.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as { type: unknown; probability: unknown };
        const type = parsed.type === "specific" ? "specific" : "general";
        const probability = typeof parsed.probability === "number" && Number.isFinite(parsed.probability)
          ? Math.max(0, Math.min(100, Math.round(parsed.probability)))
          : null;
        return { type, probability };
      } catch {
        return { type: "general", probability: null };
      }
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
        `Given the divination cast and user's 八字, produce today's daily scores. Output strict JSON only:
{"avoid":"<≤8 words of what to avoid today>","luck":"<≤8 words for today's luck theme>","relationship":<1-5>,"academic":<1-5>,"career":<1-5>,"general":<1-5>}
Output JSON only. No code fences. No commentary.`,
      ].join("\n");

      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 200,
        system: "You produce daily divination scores in JSON format. Output JSON only.",
        messages: [{ role: "user", content: userPrompt }],
      });
      const block = res.content.find((c) => c.type === "text");
      if (!block || block.type !== "text") {
        return { avoid: "overcommitting", luck: "focus and clarity", relationship: 3, academic: 3, career: 3, general: 3 };
      }
      try {
        const cleaned = block.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;
        const clampScore = (v: unknown): number => {
          const n = typeof v === "number" ? v : 3;
          return Math.max(1, Math.min(5, Math.round(n)));
        };
        return {
          avoid: typeof parsed.avoid === "string" ? parsed.avoid : "overcommitting",
          luck: typeof parsed.luck === "string" ? parsed.luck : "focus and clarity",
          relationship: clampScore(parsed.relationship),
          academic: clampScore(parsed.academic),
          career: clampScore(parsed.career),
          general: clampScore(parsed.general),
        };
      } catch {
        return { avoid: "overcommitting", luck: "focus and clarity", relationship: 3, academic: 3, career: 3, general: 3 };
      }
    },

    async getLuckyAttributes(bazi, lang) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 80,
        system: `Given a user's 八字 pillars, derive their lucky attributes. Output strict JSON only:
{"number":<1-9>,"color":"<English color name>","colorHex":"<hex code>","stone":"<one of: Emerald, Ruby, Sapphire, Citrine, Clear Quartz>"}
Output JSON only. No code fences. No commentary.`,
        messages: [
          { role: "user", content: `八字: ${JSON.stringify(bazi)}\nLang: ${lang}\n\nReturn JSON.` },
        ],
      });
      const block = res.content.find((c) => c.type === "text");
      if (!block || block.type !== "text") {
        return { number: 7, color: "Blue", colorHex: "#2980B9", stone: "Sapphire" };
      }
      try {
        const cleaned = block.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;
        return {
          number: typeof parsed.number === "number" ? Math.max(1, Math.min(9, Math.round(parsed.number))) : 7,
          color: typeof parsed.color === "string" ? parsed.color : "Blue",
          colorHex: typeof parsed.colorHex === "string" ? parsed.colorHex : "#2980B9",
          stone: typeof parsed.stone === "string" ? parsed.stone : "Sapphire",
        };
      } catch {
        return { number: 7, color: "Blue", colorHex: "#2980B9", stone: "Sapphire" };
      }
    },

    async interpret(input) {
      const { question, lang, kernel, user, recent } = input;
      const bazi = user.bazi_pillars ? JSON.parse(user.bazi_pillars) : null;
      const recentBlock = recent.length
        ? recent.slice(0, 3).map((r, i) => {
            const date = new Date(r.created_at).toISOString().slice(0, 10);
            return `  ${i + 1}. [${date}] "${r.question.slice(0, 80)}"`;
          }).join("\n")
        : "  (none)";

      const userPrompt = [
        `QUESTION: ${question}`,
        "",
        "CAST (deterministic kernel output):",
        JSON.stringify(kernel, null, 2),
        "",
        "USER 八字 CONTEXT:",
        bazi ? JSON.stringify(bazi, null, 2) : "  (not set — no hour pillar)",
        "",
        "PAST READINGS (last 3):",
        recentBlock,
        "",
        `Respond in ${lang === "zh" ? "中文" : "English"}. Be specific. Commit to a reading.`,
      ].join("\n");

      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const block = res.content.find((c) => c.type === "text");
      if (!block || block.type !== "text") throw new Error("Anthropic response missing text block");
      return block.text.trim();
    },
  };
}
