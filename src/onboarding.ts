import type { Db, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import type { Lang } from "./lang.ts";
import { STRINGS, resolveTimezone } from "./lang.ts";
import { encryptToJson } from "./crypto.ts";
import { computeBazi } from "./kernel/bazi.ts";

export interface DateParts { year: number; month: number; day: number }
export interface TimeParts { hour: number; minute: number }

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function parseDate(text: string): DateParts | null {
  const t = text.trim();
  // ISO format: 2002-10-22
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return { year: +iso[1]!, month: +iso[2]!, day: +iso[3]! };
  // "Month DD, YYYY" e.g. October 22, 2002
  const words = t.match(/([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (words) {
    const m = MONTH_NAMES[words[1]!.toLowerCase()];
    if (m) return { year: +words[3]!, month: m, day: +words[2]! };
  }
  // "DD Month YYYY" e.g. 22 October 2002
  const words2 = t.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (words2) {
    const m = MONTH_NAMES[words2[2]!.toLowerCase()];
    if (m) return { year: +words2[3]!, month: m, day: +words2[1]! };
  }
  // Chinese format: 2002年10月22日
  const zh = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (zh) return { year: +zh[1]!, month: +zh[2]!, day: +zh[3]! };
  // MM/DD/YYYY
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash && +slash[3]! > 1900) return { year: +slash[3]!, month: +slash[1]!, day: +slash[2]! };
  // YYYYMMDD (no separators)
  const compact = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact && +compact[1]! > 1900) return { year: +compact[1]!, month: +compact[2]!, day: +compact[3]! };
  // YYYY.MM.DD or YYYY/MM/DD or YYYY-MM-DD (already handled above, but also dot/slash variants)
  const dotted = t.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if (dotted && +dotted[1]! > 1900) return { year: +dotted[1]!, month: +dotted[2]!, day: +dotted[3]! };
  return null;
}

const SKIP_TOKENS = ["skip", "不知道", "跳过", "pass", "idk"];

export function parseTime(text: string): TimeParts | null {
  const t = text.trim().toLowerCase();
  if (SKIP_TOKENS.includes(t)) return null;

  // HH:MM or HH:MM am/pm
  const hhmm = t.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  if (hhmm) {
    let h = +hhmm[1]!;
    const min = +hhmm[2]!;
    if (min > 59) return null;
    const period = hhmm[3]?.toLowerCase();
    if (period === "pm" && h < 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    if (h > 23) return null;
    return { hour: h, minute: min };
  }
  // H am/pm
  const hpm = t.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (hpm) {
    let h = +hpm[1]!;
    const period = hpm[2]!.toLowerCase();
    if (period === "pm" && h < 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    if (h > 23) return null;
    return { hour: h, minute: 0 };
  }
  return null;
}

export function isSkipToken(text: string): boolean {
  return SKIP_TOKENS.includes(text.trim().toLowerCase());
}

export function buildBirthIso(date: DateParts, time: TimeParts | null, tz: string): string {
  const h = time?.hour ?? 0;
  const min = time?.minute ?? 0;
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  const hh = String(h).padStart(2, "0");
  const mi = String(min).padStart(2, "0");
  return `${date.year}-${mm}-${dd}T${hh}:${mi}:00${tz}`;
}

export async function handleOnboarding(
  user: UserRow,
  text: string,
  db: Db,
  llm?: LlmClient,
): Promise<string> {
  const lang: Lang = user.lang;

  switch (user.onboarding_state) {
    case "pending_name": {
      const name = text.trim().slice(0, 50);
      if (!name) return STRINGS.askName[lang];
      await db.setOnboardingState(user.phone, "pending_date", { name });
      return STRINGS.welcome[lang];
    }

    case "pending_date": {
      const date = parseDate(text);
      if (!date) return STRINGS.invalidDate[lang];
      const currentYear = new Date().getFullYear();
      if (date.year > currentYear || date.year < 1900) return STRINGS.invalidDate[lang];
      await db.setOnboardingState(user.phone, "pending_time", {
        pending_date_json: JSON.stringify(date),
        pending_time_json: null,
      });
      return STRINGS.askTime[lang];
    }

    case "pending_time": {
      const rawDate = user.pending_date_json ? (JSON.parse(user.pending_date_json) as DateParts) : null;
      if (!rawDate) {
        await db.setOnboardingState(user.phone, "pending_date");
        return STRINGS.welcome[lang];
      }
      if (isSkipToken(text)) {
        await db.setOnboardingState(user.phone, "pending_location", {
          pending_time_json: null,
          has_hour_pillar: 0,
        });
        return STRINGS.askLocation[lang];
      }
      const time = parseTime(text);
      if (time === null) return STRINGS.invalidTime[lang];
      await db.setOnboardingState(user.phone, "pending_location", {
        pending_time_json: JSON.stringify(time),
      });
      return STRINGS.askLocation[lang];
    }

    case "pending_location": {
      const rawDate = user.pending_date_json ? (JSON.parse(user.pending_date_json) as DateParts) : null;
      const rawTime = user.pending_time_json ? (JSON.parse(user.pending_time_json) as TimeParts) : null;

      if (!rawDate) {
        await db.setOnboardingState(user.phone, "pending_date");
        return STRINGS.welcome[lang];
      }

      let tz = resolveTimezone(text);
      if (!tz && llm) tz = await llm.resolveTimezone(text);
      if (!tz) return STRINGS.askTimezone[lang];

      const birthIso = buildBirthIso(rawDate, rawTime, tz);
      const encrypted = encryptToJson(birthIso);
      const bazi = computeBazi(birthIso);

      await db.setOnboardingState(user.phone, "complete", {
        birth_iso_encrypted: encrypted,
        birth_tz: tz,
        has_hour_pillar: rawTime !== null ? 1 : 0,
        bazi_pillars: JSON.stringify(bazi),
        clear_pending: true,
      });

      return STRINGS.onboardingComplete[lang];
    }

    default:
      return "hmm — unexpected state. try /setup to restart.";
  }
}
