// src/horizon.ts
//
// Extract the "prediction horizon" (in days) from a user's divination question.
//
// The follow-up scheduler uses this to ask about the outcome a day or two
// AFTER the predicted event window closes — e.g. a question about something
// happening in 3 days gets followed up on day 4.
//
// Strategy: cheap heuristic over en + zh phrasing. Returns null when nothing
// time-bearing is found; callers fall back to a configured default and may
// optionally hand the question off to an LLM extractor.

import type { Lang } from "./lang.ts";

/** Hard bounds — we never schedule a follow-up sooner than 1d or later than 30d. */
export const MIN_HORIZON_DAYS = 1;
export const MAX_HORIZON_DAYS = 30;

/** Number-word lookup, en + zh. Covers the small cases that come up in casual questions. */
const NUMBER_WORDS_EN: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, twenty: 20, thirty: 30,
  "a couple": 2, "a couple of": 2, "a few": 3, "several": 4,
};

const NUMBER_WORDS_ZH: Record<string, number> = {
  一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  十一: 11, 十二: 12, 十五: 15, 二十: 20, 三十: 30,
  几: 3, // "几天" ≈ a few days
};

/**
 * Day-of-week index (0 = Sun) for English weekday names.
 * Used to resolve "by Friday" / "next Monday" relative to the cast date.
 */
const WEEKDAY_EN: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/** Same but Chinese — both 周X and 星期X / 礼拜X surface in casual chat. */
const WEEKDAY_ZH: Record<string, number> = {
  日: 0, 天: 0, // 周日 / 周天
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
};

export interface HorizonResult {
  /** Days from cast date to expected event date (NOT including buffer). */
  horizon_days: number;
  /** Short tag of which rule matched — handy for tests and analytics. */
  source:
    | "today"
    | "tomorrow"
    | "tonight"
    | "this_week"
    | "weekend"
    | "next_week"
    | "next_month"
    | "weekday"
    | "next_weekday"
    | "in_n_days"
    | "in_n_weeks"
    | "in_n_months";
}

function clampDays(n: number): number {
  if (!Number.isFinite(n)) return MIN_HORIZON_DAYS;
  // Allow 0 (today) at this layer; we only enforce MIN at the buffer step.
  if (n < 0) return 0;
  if (n > MAX_HORIZON_DAYS) return MAX_HORIZON_DAYS;
  return Math.round(n);
}

function parseEnglishNumber(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (t in NUMBER_WORDS_EN) return NUMBER_WORDS_EN[t]!;
  return null;
}

function parseChineseNumber(token: string): number | null {
  const t = token.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (t in NUMBER_WORDS_ZH) return NUMBER_WORDS_ZH[t]!;
  // Compound like 十三 → 13, 二十一 → 21
  if (/^[一二三四五六七八九十]+$/.test(t)) {
    const idx = t.indexOf("十");
    if (idx >= 0) {
      const left = t.slice(0, idx);
      const right = t.slice(idx + 1);
      const tens = left ? (NUMBER_WORDS_ZH[left] ?? 1) : 1;
      const ones = right ? (NUMBER_WORDS_ZH[right] ?? 0) : 0;
      return tens * 10 + ones;
    }
  }
  return null;
}

function daysUntilWeekday(target: number, todayDow: number, prefix: "this" | "next"): number {
  // todayDow and target are 0-6 (Sun=0). Returns days from today to that weekday.
  //   this  → this coming occurrence; 0 means "today is already that day".
  //   next  → the occurrence in the following 7-day window (always 7..13 days out).
  const baseDelta = (target - todayDow + 7) % 7;
  return prefix === "this" ? baseDelta : baseDelta + 7;
}

/**
 * Extract a horizon (days from now to predicted event) from the question.
 * Returns null if no time phrase is recognized.
 *
 * `now` is the cast timestamp; only used to resolve "by Friday"-style phrases.
 */
export function extractHorizonHeuristic(
  question: string,
  lang: Lang,
  now: Date = new Date(),
): HorizonResult | null {
  if (!question) return null;
  const text = question.toLowerCase();
  const todayDow = now.getDay();

  // --- Chinese patterns (run first when lang=zh so we don't double-match). ---
  if (lang === "zh") {
    // 今天 / 今晚 / 今夜
    if (/今(天|晚|夜)/.test(question)) {
      return { horizon_days: clampDays(0), source: /今(晚|夜)/.test(question) ? "tonight" : "today" };
    }
    // 明天 / 明日 / 明早 / 明晚
    if (/明(天|日|早|晚)/.test(question)) {
      return { horizon_days: clampDays(1), source: "tomorrow" };
    }
    // 后天
    if (/后天/.test(question)) {
      return { horizon_days: clampDays(2), source: "in_n_days" };
    }
    // 大后天
    if (/大后天/.test(question)) {
      return { horizon_days: clampDays(3), source: "in_n_days" };
    }
    // 这周末 / 周末
    if (/(这)?周末/.test(question)) {
      // Days until Saturday from today (closest weekend day).
      const delta = (6 - todayDow + 7) % 7 || 0;
      return { horizon_days: clampDays(delta), source: "weekend" };
    }
    // 下(个)?周X / 下星期X / 下礼拜X
    const nextWeekdayZh = question.match(/下(?:个)?(?:周|星期|礼拜)([日天一二三四五六])/);
    if (nextWeekdayZh) {
      const target = WEEKDAY_ZH[nextWeekdayZh[1]!]!;
      return { horizon_days: clampDays(daysUntilWeekday(target, todayDow, "next")), source: "next_weekday" };
    }
    // 这(个)?周X / 这星期X / 周X
    const thisWeekdayZh = question.match(/(?:这(?:个)?)?(?:周|星期|礼拜)([日天一二三四五六])/);
    if (thisWeekdayZh) {
      const target = WEEKDAY_ZH[thisWeekdayZh[1]!]!;
      return { horizon_days: clampDays(daysUntilWeekday(target, todayDow, "this")), source: "weekday" };
    }
    // 下(个)?周 / 下星期 / 下礼拜  (no specific day)
    if (/下(?:个)?(?:周|星期|礼拜)(?![日天一二三四五六])/.test(question)) {
      const delta = ((1 - todayDow + 7) % 7) + 7; // start of next week (Mon)
      return { horizon_days: clampDays(delta), source: "next_week" };
    }
    // 下个月 / 下月
    if (/下(?:个)?月/.test(question)) {
      return { horizon_days: clampDays(30), source: "next_month" };
    }
    // N 天(后|内|之后)?
    const nDaysZh = question.match(/([0-9一二三四五六七八九十两几]+)\s*天\s*(?:后|内|之后|之内|以后|以内)?/);
    if (nDaysZh) {
      const n = parseChineseNumber(nDaysZh[1]!);
      if (n != null) return { horizon_days: clampDays(n), source: "in_n_days" };
    }
    // N 周/星期/礼拜(后|内)?
    const nWeeksZh = question.match(/([0-9一二三四五六七八九十两几]+)\s*(?:周|星期|礼拜)\s*(?:后|内|之后|之内|以后|以内)?/);
    if (nWeeksZh) {
      const n = parseChineseNumber(nWeeksZh[1]!);
      if (n != null) return { horizon_days: clampDays(n * 7), source: "in_n_weeks" };
    }
    // N 个月(后|内)?
    const nMonthsZh = question.match(/([0-9一二三四五六七八九十两几]+)\s*个?\s*月\s*(?:后|内|之后|之内|以后|以内)?/);
    if (nMonthsZh) {
      const n = parseChineseNumber(nMonthsZh[1]!);
      if (n != null) return { horizon_days: clampDays(n * 30), source: "in_n_months" };
    }
  }

  // --- English patterns (also runs for zh as fallback because users mix). ---
  // today / tonight
  if (/\btonight\b/.test(text)) return { horizon_days: clampDays(0), source: "tonight" };
  if (/\btoday\b/.test(text)) return { horizon_days: clampDays(0), source: "today" };
  // tomorrow
  if (/\btomorrow\b/.test(text)) return { horizon_days: clampDays(1), source: "tomorrow" };
  // day after tomorrow
  if (/\bday after tomorrow\b/.test(text)) return { horizon_days: clampDays(2), source: "in_n_days" };
  // this weekend / weekend
  if (/\b(this )?weekend\b/.test(text)) {
    const delta = (6 - todayDow + 7) % 7 || 0;
    return { horizon_days: clampDays(delta), source: "weekend" };
  }
  // next week
  if (/\bnext week\b/.test(text)) {
    const delta = ((1 - todayDow + 7) % 7) + 7;
    return { horizon_days: clampDays(delta), source: "next_week" };
  }
  // this week (no specific day)
  if (/\bthis week\b/.test(text)) {
    return { horizon_days: clampDays(3), source: "this_week" };
  }
  // next month
  if (/\bnext month\b/.test(text)) {
    return { horizon_days: clampDays(30), source: "next_month" };
  }
  // by / on / next <weekday>
  const nextWeekdayEn = text.match(/\bnext (sun|mon|tues|wednes|thurs|fri|satur)day\b/);
  if (nextWeekdayEn) {
    const name = nextWeekdayEn[1]! + "day";
    const target = WEEKDAY_EN[name];
    if (target !== undefined) {
      return { horizon_days: clampDays(daysUntilWeekday(target, todayDow, "next")), source: "next_weekday" };
    }
  }
  const byWeekdayEn = text.match(/\b(?:by|on|this) (sun|mon|tues|wednes|thurs|fri|satur)day\b/);
  if (byWeekdayEn) {
    const name = byWeekdayEn[1]! + "day";
    const target = WEEKDAY_EN[name];
    if (target !== undefined) {
      return { horizon_days: clampDays(daysUntilWeekday(target, todayDow, "this")), source: "weekday" };
    }
  }
  // in N day(s) / within N days / N days from now
  const nDaysEn = text.match(/\b(?:in|within|after)\s+((?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty|a couple of|a couple|a few|several))\s+days?\b/);
  if (nDaysEn) {
    const n = parseEnglishNumber(nDaysEn[1]!);
    if (n != null) return { horizon_days: clampDays(n), source: "in_n_days" };
  }
  // in N week(s)
  const nWeeksEn = text.match(/\b(?:in|within|after)\s+((?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|a couple of|a couple|a few|several))\s+weeks?\b/);
  if (nWeeksEn) {
    const n = parseEnglishNumber(nWeeksEn[1]!);
    if (n != null) return { horizon_days: clampDays(n * 7), source: "in_n_weeks" };
  }
  // in N month(s)
  const nMonthsEn = text.match(/\b(?:in|within|after)\s+((?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|a couple of|a couple|a few|several))\s+months?\b/);
  if (nMonthsEn) {
    const n = parseEnglishNumber(nMonthsEn[1]!);
    if (n != null) return { horizon_days: clampDays(n * 30), source: "in_n_months" };
  }

  return null;
}

/**
 * Convert an extracted horizon to a follow-up delay in milliseconds.
 *
 * Always at least MIN_HORIZON_DAYS — a same-day question still gets followed
 * up the next day, not 30 seconds later (use DEMO_FOLLOW_UP_SECONDS for demos).
 */
export function followUpMsFromHorizon(horizonDays: number, bufferDays: number): number {
  const total = Math.max(MIN_HORIZON_DAYS, Math.min(MAX_HORIZON_DAYS, horizonDays + bufferDays));
  return total * 86_400_000;
}
