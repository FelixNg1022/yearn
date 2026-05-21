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

export interface LlmClient {
  interpret(input: InterpretInput): Promise<string>;
}

export function createLlm(): LlmClient {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey() });

  return {
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
