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

function formatCastSummary(method: "meihua" | "liuren", kernel: unknown): string {
  if (method === "liuren") {
    const r = kernel as LiurenResult;
    return `🀄 小六壬 · ${r.hour_palace.name}`;
  }
  const r = kernel as MeihuaResult;
  return `🎴 梅花易数 · ${r.primary.name_zh} → ${r.changed.name_zh}`;
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

  const recent = await db.getRecentReadings(phone, 5);
  const followUpAt = now + followUpMs;

  if (classification.type === "specific") {
    const prob = classification.probability ?? 50;
    const interpretation = await llm.interpret({
      question: text,
      lang,
      kernel,
      user,
      recent,
      probability: prob,
    });

    const reply = `${formatCastSummary(method, kernel)}\n\n${interpretation}\n\n${STRINGS.followUpNote[lang]}`;

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
      question_type: "specific",
      predicted_probability: prob,
    });

    await db.incrementReadingsToday(phone, now);

    return {
      reply,
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

  // General question — short text reading only (daily card sends separately at 8am).
  const interpretation = await llm.interpret({ question: text, lang, kernel, user, recent });

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

  const reply = `${formatCastSummary(method, kernel)}\n\n${interpretation}\n\n${STRINGS.followUpNote[lang]}`;
  return {
    reply,
    castJson: JSON.stringify(kernel),
    method,
    kernel,
    horizonDays,
    followUpAt,
    question_type: "general",
    predicted_probability: null,
    daily_scores: null,
  };
}

// Re-export bounds so callers can use them in tests/validation.
export { MAX_HORIZON_DAYS, MIN_HORIZON_DAYS };
