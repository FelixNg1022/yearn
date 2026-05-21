// src/query.ts
import type { Db, Lang, UserRow } from "./db.ts";
import type { LlmClient, DailyScores } from "./llm.ts";
import { castMeihua } from "./kernel/meihua.ts";
import { castLiuren } from "./kernel/liuren.ts";
import type { MeihuaResult } from "./kernel/meihua.ts";
import type { LiurenResult } from "./kernel/liuren.ts";
import { STRINGS } from "./lang.ts";
import {
  extractHorizonHeuristic,
  followUpMsFromHorizon,
  MAX_HORIZON_DAYS,
  MIN_HORIZON_DAYS,
} from "./horizon.ts";

const LIUREN_TRIGGERS = ["小六壬", "六壬", "liuren", "xiaoliuren"];

export function detectMethod(text: string): "meihua" | "liuren" {
  const lower = text.toLowerCase();
  return LIUREN_TRIGGERS.some((k) => lower.includes(k.toLowerCase())) ? "liuren" : "meihua";
}

function formatMeihuaHeader(r: MeihuaResult): string {
  const m = r.math;
  return [
    `🎴 梅花易数 · ${new Date(r.cast_at_iso).toLocaleString()}`,
    `lunar: ${r.lunar.year_gz}年 月${r.lunar.month} 日${r.lunar.day} ${r.lunar.hour_zhi}时`,
    `upper: (${m.year_zhi_num}+${m.lunar_month}+${m.lunar_day}) mod 8 = ${m.upper_mod} → ${m.upper_trigram}`,
    `lower: (+${m.hour_zhi_num}) mod 8 = ${m.lower_mod} → ${m.lower_trigram}`,
    `line:  ${m.changing_sum} mod 6 = ${m.changing_line} → line ${m.changing_line} changing`,
    `→ ${r.primary.name_zh} (${r.primary.num}), changing to ${r.changed.name_zh} (${r.changed.num})`,
  ].join("\n");
}

function formatLiurenHeader(r: LiurenResult): string {
  return [
    `🀄 小六壬 · ${new Date(r.cast_at_iso).toLocaleString()}`,
    `lunar: 月${r.lunar.month} 日${r.lunar.day} ${r.lunar.hour_zhi}时`,
    `月 → ${r.month_palace.name}`,
    `日 → ${r.day_palace.name}`,
    `时 → ${r.hour_palace.name}`,
  ].join("\n");
}

export interface QueryDeps {
  db: Db;
  llm: LlmClient;
  /** Fallback follow-up delay used when no horizon can be extracted from the question. */
  defaultFollowUpMs: number;
  /** Days to wait *after* the predicted event before asking how it played out. */
  bufferDays: number;
  /**
   * Optional hard override (used by demo mode). When set, both default + horizon
   * are ignored and this exact delay is used. Pass `undefined` in prod.
   */
  demoFollowUpMs?: number;
  /** Whether to fall back to an LLM extractor when the heuristic finds nothing. */
  useLlmHorizonFallback?: boolean;
}

export async function runQuery(
  phone: string,
  text: string,
  user: UserRow,
  receivedAt: Date,
  deps: QueryDeps,
): Promise<{
  reply: string;
  castJson: string;
  method: "meihua" | "liuren";
  kernel: unknown;
  horizonDays: number | null;
  followUpAt: number;
  question_type: "general" | "specific";
  predicted_probability: number | null;
  daily_scores: DailyScores | null;
}> {
  const { db, llm, defaultFollowUpMs, bufferDays, demoFollowUpMs, useLlmHorizonFallback } = deps;
  const method = detectMethod(text);
  const kernel = method === "liuren" ? castLiuren(receivedAt) : castMeihua(receivedAt);
  const lang: Lang = user.lang;

  // Resolve the prediction horizon (days from now to the event the user is
  // asking about). Heuristic first, optional LLM fallback when nothing matches.
  let horizonDays: number | null = null;
  const heuristic = extractHorizonHeuristic(text, lang, receivedAt);
  if (heuristic) {
    horizonDays = heuristic.horizon_days;
  } else if (useLlmHorizonFallback) {
    try {
      horizonDays = await llm.extractHorizonDays(text, lang);
    } catch (err) {
      console.error("[query] horizon llm fallback failed:", err);
      horizonDays = null;
    }
  }

  // Demo mode strictly overrides everything else (used for live demos so the
  // operator doesn't have to wait days for the scheduler to fire).
  const now = receivedAt.getTime();
  let followUpMs: number;
  if (demoFollowUpMs !== undefined) {
    followUpMs = demoFollowUpMs;
  } else if (horizonDays != null) {
    followUpMs = followUpMsFromHorizon(horizonDays, bufferDays);
  } else {
    followUpMs = defaultFollowUpMs;
  }

  // Classify the question type in parallel with horizon extraction results.
  const classification = await llm.classifyQuestion(text, lang);

  const recent = await db.getRecentReadings(phone, 3);
  const followUpAt = now + followUpMs;

  if (classification.type === "specific") {
    // For specific probability questions, skip full interpretation and return a simple text reply.
    const prob = classification.probability ?? 50;
    const replyText = lang === "zh"
      ? `基于当前卦象，预测概率：${prob}%。`
      : `Based on the cast, estimated probability: ${prob}%.`;

    await db.recordReading({
      phone,
      question: text,
      method,
      cast_json: JSON.stringify(kernel),
      interpretation: replyText,
      lang,
      created_at: now,
      follow_up_at: followUpAt,
      predicted_horizon_days: horizonDays,
      question_type: "specific",
      predicted_probability: prob,
    });

    await db.incrementReadingsToday(phone, now);

    return {
      reply: replyText,
      castJson: JSON.stringify(kernel),
      method,
      kernel,
      horizonDays,
      followUpAt,
      question_type: "specific",
      predicted_probability: prob,
      daily_scores: null,
    };
  }

  // General question path: get interpretation and daily scores in parallel.
  const [dailyScores, interpretation] = await Promise.all([
    llm.getDailyScores(text, kernel, user),
    llm.interpret({ question: text, lang, kernel, user, recent }),
  ]);

  const header = method === "liuren"
    ? formatLiurenHeader(kernel as LiurenResult)
    : formatMeihuaHeader(kernel as MeihuaResult);

  await db.recordReading({
    phone,
    question: text,
    method,
    cast_json: JSON.stringify(kernel),
    interpretation,
    lang,
    created_at: now,
    follow_up_at: followUpAt,
    predicted_horizon_days: horizonDays,
    question_type: "general",
    predicted_probability: null,
  });

  await db.incrementReadingsToday(phone, now);

  const reply = `${header}\n\n${interpretation}\n\n${STRINGS.followUpNote[lang]}`;
  return {
    reply,
    castJson: JSON.stringify(kernel),
    method,
    kernel,
    horizonDays,
    followUpAt,
    question_type: "general",
    predicted_probability: null,
    daily_scores: dailyScores,
  };
}

// Re-export bounds so callers can use them in tests/validation.
export { MAX_HORIZON_DAYS, MIN_HORIZON_DAYS };
