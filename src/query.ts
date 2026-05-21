// src/query.ts
import type { Db, Lang, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import { castMeihua } from "./kernel/meihua.ts";
import { castLiuren } from "./kernel/liuren.ts";
import type { MeihuaResult } from "./kernel/meihua.ts";
import type { LiurenResult } from "./kernel/liuren.ts";
import { STRINGS } from "./lang.ts";

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
  followUpMs: number;
}

export async function runQuery(
  phone: string,
  text: string,
  user: UserRow,
  receivedAt: Date,
  deps: QueryDeps,
): Promise<{ reply: string; castJson: string; method: "meihua" | "liuren"; kernel: unknown }> {
  const { db, llm, followUpMs } = deps;
  const method = detectMethod(text);
  const kernel = method === "liuren" ? castLiuren(receivedAt) : castMeihua(receivedAt);
  const lang: Lang = user.lang;

  const recent = await db.getRecentReadings(phone, 3);
  const interpretation = await llm.interpret({ question: text, lang, kernel, user, recent });

  const header = method === "liuren"
    ? formatLiurenHeader(kernel as LiurenResult)
    : formatMeihuaHeader(kernel as MeihuaResult);

  const now = receivedAt.getTime();
  await db.recordReading({
    phone,
    question: text,
    method,
    cast_json: JSON.stringify(kernel),
    interpretation,
    lang,
    created_at: now,
    follow_up_at: now + followUpMs,
  });

  await db.incrementReadingsToday(phone, now);

  const reply = `${header}\n\n${interpretation}\n\n${STRINGS.followUpNote[lang]}`;
  return { reply, castJson: JSON.stringify(kernel), method, kernel };
}
