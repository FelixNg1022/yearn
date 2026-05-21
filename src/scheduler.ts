// src/scheduler.ts
import type { Db } from "./db.ts";
import type { Lang } from "./lang.ts";
import { sendFollowUp } from "./spectrum/send.ts";

export function buildFollowUpText(question: string, lang: Lang, days: number): string {
  const q = question.length > 80 ? question.slice(0, 77) + "…" : question;
  return lang === "zh"
    ? `${days} 天前你问：「${q}」——后来怎么样？回 yes / no / mixed（可加一句备注）。`
    : `${days} days ago you asked: "${q}" — how did it play out? reply: yes / no / mixed (feel free to add a note).`;
}

export interface SchedulerOptions {
  db: Db;
  intervalMs: number;
  followUpDays: number;
}

export interface Scheduler {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
}

export function createScheduler(opts: SchedulerOptions): Scheduler {
  const { db, intervalMs, followUpDays } = opts;
  let handle: ReturnType<typeof setInterval> | null = null;

  const tick = async (): Promise<void> => {
    const now = Date.now();
    const pending = await db.getPendingFollowUps(now);
    for (const reading of pending) {
      const user = await db.getUser(reading.phone);
      const lang: Lang = user?.lang ?? reading.lang;
      try {
        await sendFollowUp(reading.phone, reading.question, lang, followUpDays);
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
