// src/router.ts
import type { Db, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import { detectLang, STRINGS } from "./lang.ts";
import { handleOnboarding } from "./onboarding.ts";
import { handleCommand } from "./commands.ts";
import { parseOutcome, looksLikeOutcome, isShareRequest } from "./outcomes.ts";
import { runQuery } from "./query.ts";
import { renderCastCard, renderProfileCard, renderDailyReadingCard } from "./card/render.ts";
import { sendText, sendCard, sendShareInvite } from "./spectrum/send.ts";
import { config } from "./config.ts";

const OUTCOME_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface RouterDeps {
  db: Db;
  llm: LlmClient;
}

export async function route(
  phone: string,
  text: string,
  receivedAt: Date,
  deps: RouterDeps,
): Promise<void> {
  const { db } = deps;
  const now = receivedAt.getTime();
  const trimmed = text.trim();

  let user = await db.getUser(phone);
  if (!user) {
    const lang = detectLang(trimmed);
    await db.upsertUser({
      phone,
      lang,
      onboarding_state: "pending_name",
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    user = (await db.getUser(phone))!;
    await sendText(phone, STRINGS.askName[lang]);
    return;
  }

  await db.touchLastSeen(phone, now);

  if (user.delete_pending) {
    if (trimmed.toLowerCase() === "confirm delete") {
      await db.deleteUser(phone);
      await sendText(phone, STRINGS.deleteConfirmed[user.lang]);
    } else {
      await db.setDeletePending(phone, 0);
      await sendText(phone, STRINGS.deleteCancelled[user.lang]);
    }
    return;
  }

  if (trimmed.startsWith("/")) {
    const result = await handleCommand(trimmed, user, db);
    if (result.sideEffect === "render_profile_card") {
      await sendProfileCard(phone, user, deps);
      return;
    }
    await sendText(phone, result.reply);
    return;
  }

  if (user.onboarding_state !== "complete") {
    const reply = await handleOnboarding(user, trimmed, db);
    await sendText(phone, reply);
    // Check if onboarding just completed — if so, send profile card
    const refreshedUser = await db.getUser(phone);
    if (refreshedUser && refreshedUser.onboarding_state === "complete") {
      await sendProfileCard(phone, refreshedUser, deps);
    }
    return;
  }

  if (isShareRequest(trimmed)) {
    const yesOutcome = await db.getMostRecentYesOutcome(phone);
    if (yesOutcome) {
      const readings = await db.getRecentReadings(phone, 1);
      const reading = readings[0];
      if (reading) {
        const cast = JSON.parse(reading.cast_json);
        const png = await renderCastCard({
          question: yesOutcome.question,
          cast,
          interpretation: reading.interpretation,
          lang: user.lang,
          timestamp: new Date(reading.created_at),
          mode: "outcome",
        });
        await sendCard(phone, "🎯 called it.", png);
        await db.markShared(yesOutcome.reading_id);
      }
    }
    return;
  }

  if (looksLikeOutcome(trimmed)) {
    const pending = await db.getMostRecentPendingOutcome(phone, OUTCOME_WINDOW_MS);
    if (pending) {
      const parsed = parseOutcome(trimmed);
      if (parsed) {
        await db.recordOutcome({
          reading_id: pending.id,
          outcome: parsed.outcome,
          user_note: parsed.note,
          responded_at: now,
          shared: 0,
        });
        const ack = outcomeAck(parsed.outcome, user.lang);
        await sendText(phone, ack);
        if (parsed.outcome === "yes") {
          await sendShareInvite(phone, user.lang);
        }
        return;
      }
    }
  }

  const refreshed = await db.getUser(phone);
  const daily = config.rateLimitPerDay();
  if (refreshed && refreshed.readings_today >= daily) {
    await sendText(phone, STRINGS.rateLimited[user.lang]);
    return;
  }

  const demoSecs = config.demoFollowUpSeconds();
  const result = await runQuery(phone, trimmed, user, receivedAt, {
    db: deps.db,
    llm: deps.llm,
    defaultFollowUpMs: config.followUpDays() * 24 * 60 * 60 * 1000,
    bufferDays: config.followUpBufferDays(),
    demoFollowUpMs: demoSecs !== undefined ? demoSecs * 1000 : undefined,
    useLlmHorizonFallback: config.useLlmHorizonFallback(),
  });

  if (result.question_type === "specific") {
    // Text-only reply for specific probability questions — no card.
    await sendText(phone, result.reply);
    return;
  }

  // General question — render Daily Reading Card.
  if (result.daily_scores) {
    const displayName = user.name ?? phone.slice(-4);
    const png = await renderDailyReadingCard({
      question: trimmed,
      date: receivedAt,
      avoid: result.daily_scores.avoid,
      luck: result.daily_scores.luck,
      relationship: result.daily_scores.relationship,
      academic: result.daily_scores.academic,
      career: result.daily_scores.career,
      general: result.daily_scores.general,
      name: displayName,
      lang: user.lang,
    });
    await sendCard(phone, result.reply, png);
    return;
  }

  // Fallback: use classic cast card if somehow daily_scores is null for general.
  const png = await renderCastCard({
    question: trimmed,
    cast: result.kernel,
    interpretation: result.reply,
    lang: user.lang,
    timestamp: receivedAt,
    mode: "cast",
  });
  await sendCard(phone, result.reply, png);
}

async function sendProfileCard(phone: string, user: import("./db.ts").UserRow, deps: RouterDeps): Promise<void> {
  const { db, llm } = deps;
  const displayName = user.name ?? phone.slice(-4);
  const bazi = user.bazi_pillars ? JSON.parse(user.bazi_pillars) : null;

  if (!bazi) {
    await sendText(phone, user.lang === "zh"
      ? "还没有八字数据，请先完成入门设置。"
      : "No 八字 on file yet — complete setup first.");
    return;
  }

  // Get lucky attributes and a broad interpretation in parallel.
  const recentReadings = await db.getRecentReadings(phone, 3);
  const [luckyAttrs, broadReading] = await Promise.all([
    llm.getLuckyAttributes(bazi, user.lang),
    llm.interpret({
      question: user.lang === "zh" ? "请给我一个关于近期整体运势的宏观解读。" : "Please give me a broad projection of my overall fortune for the near future.",
      lang: user.lang,
      kernel: {},
      user,
      recent: recentReadings,
    }),
  ]);

  const png = await renderProfileCard({
    name: displayName,
    luckyNumber: luckyAttrs.number,
    luckyColor: luckyAttrs.color,
    luckyColorHex: luckyAttrs.colorHex,
    luckyStone: luckyAttrs.stone,
    reading: broadReading,
    lang: user.lang,
  });

  const caption = user.lang === "zh"
    ? `你的幸运数字是 ${luckyAttrs.number}，幸运颜色是 ${luckyAttrs.color}，幸运宝石是 ${luckyAttrs.stone}。`
    : `Your lucky number is ${luckyAttrs.number}, lucky color is ${luckyAttrs.color}, lucky stone is ${luckyAttrs.stone}.`;
  await sendCard(phone, caption, png);
}

function outcomeAck(outcome: "yes" | "no" | "mixed", lang: "en" | "zh"): string {
  if (lang === "zh") {
    if (outcome === "yes") return "好，记下来了：这次准了 ✅";
    if (outcome === "no") return "好，记下来了：这次没准 ❌";
    return "好，记下来了：一半一半 ⚖️";
  }
  if (outcome === "yes") return "logged: it played out ✅";
  if (outcome === "no") return "logged: it didn't ❌";
  return "logged: mixed ⚖️";
}
