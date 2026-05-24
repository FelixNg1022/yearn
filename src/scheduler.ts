// src/scheduler.ts
import type { Db } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import type { Lang } from "./lang.ts";
import { sendFollowUp } from "./spectrum/send.ts";
import { tickDailyCards } from "./dailyCard.ts";
import { nextEightAmUtc } from "./router.ts";

const DAY_MS = 86_400_000;

/** Days between `createdAt` and `now`, rounded to the nearest day, min 1. */
export function elapsedDays(createdAt: number, now: number): number {
  const diff = Math.max(0, now - createdAt);
  return Math.max(1, Math.round(diff / DAY_MS));
}

export function buildFollowUpText(question: string, lang: Lang, days: number): string {
  const q = question.length > 80 ? question.slice(0, 77) + "…" : question;
  return lang === "zh"
    ? `${days} 天前你问：「${q}」——后来怎么样？回 yes / no / mixed（可加一句备注）。`
    : `${days} days ago you asked: "${q}" — how did it play out? reply: yes / no / mixed (feel free to add a note).`;
}

export interface SchedulerOptions {
  db: Db;
  llm: LlmClient;
  intervalMs: number;
}

export interface Scheduler {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
}

export function createScheduler(opts: SchedulerOptions): Scheduler {
  const { db, llm, intervalMs } = opts;
  let handle: ReturnType<typeof setInterval> | null = null;

  const tick = async (): Promise<void> => {
    const now = Date.now();

    // Heal: arm daily cards for any complete users who slipped through
    try {
      const unarmed = await db.getCompleteUsersWithoutDailyCard();
      for (const u of unarmed) {
        const nextAt = nextEightAmUtc(u.birth_tz!, now);
        await db.enableDailyCard(u.phone, nextAt);
        console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: "healed daily card", phone: u.phone.slice(-4) }));
      }
    } catch (err) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: "ERROR", msg: "heal daily cards", err: String(err) }));
    }

    // Daily morning cards
    await tickDailyCards(now, { db, llm });

    // Follow-up reminders
    const pending = await db.getPendingFollowUps(now);
    for (const reading of pending) {
      const user = await db.getUser(reading.phone);
      const lang: Lang = user?.lang ?? reading.lang;
      const days = elapsedDays(reading.created_at, now);
      try {
        await sendFollowUp(reading.phone, reading.question, lang, days);
        await db.markFollowedUp(reading.id);
      } catch (err) {
        console.error(`[scheduler] failed DM for reading ${reading.id}:`, err);
      }
    }
  };

  return {
    tick,
    start() {
      if (handle) return;
      handle = setInterval(() => void tick().catch((e) => console.error("[scheduler] tick error:", e)), intervalMs);
    },
    stop() {
      if (handle) { clearInterval(handle); handle = null; }
    },
  };
}
