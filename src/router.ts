// src/router.ts
import type { Db, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import { detectLang, STRINGS } from "./lang.ts";
import { handleOnboarding } from "./onboarding.ts";
import { handleCommand } from "./commands.ts";
import { parseOutcome, looksLikeOutcome, isShareRequest } from "./outcomes.ts";
import { runQuery } from "./query.ts";
import { renderCastCard } from "./card/render.ts";
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
      onboarding_state: "pending_date",
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    user = (await db.getUser(phone))!;
    await sendText(phone, STRINGS.welcome[lang]);
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
    await sendText(phone, result.reply);
    return;
  }

  if (user.onboarding_state !== "complete") {
    const reply = await handleOnboarding(user, trimmed, db);
    await sendText(phone, reply);
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

  const followUpMs = config.demoFollowUpSeconds() !== undefined
    ? config.demoFollowUpSeconds()! * 1000
    : config.followUpDays() * 24 * 60 * 60 * 1000;

  const result = await runQuery(phone, trimmed, user, receivedAt, {
    db: deps.db,
    llm: deps.llm,
    followUpMs,
  });

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
