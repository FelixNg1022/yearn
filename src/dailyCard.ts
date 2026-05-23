// src/dailyCard.ts — sends the morning daily reading card to all eligible users.
import type { Db, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import { castMeihua } from "./kernel/meihua.ts";
import { renderDailyReadingCard } from "./card/render.ts";
import { sendCard } from "./spectrum/send.ts";
import { nextEightAmUtc } from "./router.ts";

export interface DailyCardDeps {
  db: Db;
  llm: LlmClient;
}

/** Send a daily reading card to one user. */
export async function sendDailyCard(user: UserRow, deps: DailyCardDeps): Promise<void> {
  const { llm } = deps;
  const now = new Date();
  const cast = castMeihua(now);

  const question = user.lang === "zh"
    ? "今天的整体运势如何？"
    : "what is my overall fortune today?";

  const [scores, interpretation] = await Promise.all([
    llm.getDailyScores(question, cast, user),
    llm.interpret({
      question,
      lang: user.lang,
      kernel: cast,
      user,
      recent: [],
    }),
  ]);

  const displayName = user.name ?? user.phone.slice(-4);
  const png = await renderDailyReadingCard({
    name: displayName,
    date: now,
    avoid: scores.avoid,
    general: scores.general,
    relationship: scores.relationship,
    academic: scores.academic,
    career: scores.career,
  });

  const caption = user.lang === "zh"
    ? `早安！✨ 今日运势\n${interpretation}`
    : `good morning! ✨ today's fortune\n${interpretation}`;

  await sendCard(user.phone, caption, png);
}

/** Called by the scheduler. Finds all users due for their morning card, sends, and reschedules. */
export async function tickDailyCards(now: number, deps: DailyCardDeps): Promise<void> {
  const { db } = deps;
  const users = await db.getUsersDueForDailyCard(now);

  for (const user of users) {
    try {
      await sendDailyCard(user, deps);
      // Schedule next delivery at 8am tomorrow in their local timezone
      const tz = user.birth_tz ?? "+00:00";
      const nextAt = nextEightAmUtc(tz, now);
      await db.setNextDailyAt(user.phone, nextAt);
    } catch (err) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(), level: "ERROR",
        msg: "dailyCard", phone: user.phone.slice(-4), err: String(err),
      }));
    }
  }
}
