// src/router.ts
import type { Db, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import { detectLang, STRINGS } from "./lang.ts";
import { handleOnboarding } from "./onboarding.ts";
import { handleCommand } from "./commands.ts";
import { parseOutcome, looksLikeOutcome, isShareRequest } from "./outcomes.ts";
import { runQuery } from "./query.ts";
import { renderProfileCard, renderDailyReadingCard, renderSocialCard } from "./card/render.ts";
import { trimProjection } from "./card/projection.ts";
import { sendText, sendCard, sendShareInvite } from "./spectrum/send.ts";
import { config } from "./config.ts";

const SHARE_URL = "https://yearn-three.vercel.app/";

/** Accept outcome replies for up to 14 days after follow-up was sent. */
const OUTCOME_RESPONSE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const GREETING_PATTERNS = /^(hi|hey|hello|hiya|sup|yo|hii|hiii|hi yearn|hey yearn|hello yearn|start|begin|go|👋|🙋|🙋‍♀️|🙋‍♂️)[\s!.]*$/i;

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
    const fromLanding = GREETING_PATTERNS.test(trimmed);
    await sendText(phone, fromLanding ? STRINGS.askNameFromLanding[lang] : STRINGS.askName[lang]);
    return;
  }

  await db.touchLastSeen(phone, now);

  // Greeting from a fully onboarded user → welcome back
  if (GREETING_PATTERNS.test(trimmed) && user.onboarding_state === "complete") {
    const name = user.name ? `, ${user.name}` : "";
    const msg = user.lang === "zh"
      ? `欢迎回来${name}！✨ 想问宇宙什么？`
      : `omg welcome back${name} ✨ what's on your mind? the universe is listening`;
    await sendText(phone, msg);
    return;
  }

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
    const reply = await handleOnboarding(user, trimmed, db, deps.llm);
    await sendText(phone, reply);
    const refreshedUser = await db.getUser(phone);
    if (refreshedUser && refreshedUser.onboarding_state === "complete") {
      await sendText(phone, STRINGS.profileBrewing[refreshedUser.lang]);
      void prepareAndSendProfileCard(phone, refreshedUser, deps);
    }
    return;
  }

  if (isShareRequest(trimmed)) {
    const yesOutcome = await db.getMostRecentYesOutcome(phone);
    if (yesOutcome) {
      const displayName = user.name ?? phone.slice(-4);
      const png = await renderSocialCard({
        name: displayName,
        shareUrl: SHARE_URL,
      });
      await sendCard(phone, "the universe called it 🎯 here's your card", png);
      await db.markShared(yesOutcome.reading_id);
    } else {
      await sendText(phone, STRINGS.shareNoOutcome[user.lang]);
    }
    return;
  }

  if (looksLikeOutcome(trimmed)) {
    const pending = await db.getMostRecentPendingOutcome(phone, OUTCOME_RESPONSE_WINDOW_MS);
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
        if (parsed.outcome === "yes") {
          await sendText(phone, STRINGS.outcomeYes[user.lang]);
          await sendShareInvite(phone, user.lang);
        } else if (parsed.outcome === "no") {
          await sendText(phone, STRINGS.outcomeNo[user.lang]);
        } else {
          await sendText(phone, STRINGS.outcomeMixed[user.lang]);
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
    await sendText(phone, result.reply + STRINGS.specificQuestionNote[user.lang]);
    return;
  }

  // General question — render Daily Reading Card.
  if (result.daily_scores) {
    const displayName = user.name ?? phone.slice(-4);
    const png = await renderDailyReadingCard({
      name: displayName,
      date: receivedAt,
      avoid: result.daily_scores.avoid,
      relationship: result.daily_scores.relationship,
      academic: result.daily_scores.academic,
      career: result.daily_scores.career,
      general: result.daily_scores.general,
      shareUrl: SHARE_URL,
    });
    await sendCard(phone, result.reply, png);
    return;
  }

  // Fallback: text-only if daily_scores somehow null for a general question.
  await sendText(phone, result.reply);
}

/** Called on /profile — acks immediately, then generates + sends the card in the background. */
async function sendProfileCard(phone: string, user: import("./db.ts").UserRow, deps: RouterDeps): Promise<void> {
  if (!user.bazi_pillars) {
    await sendText(phone, user.lang === "zh"
      ? "还没有八字数据哦～ 发「/setup」来设置一下吧 ✨"
      : "i need your 八字 first ✨ send /setup to get started!");
    return;
  }

  // Ack immediately so the user isn't left in silence
  await sendText(phone, STRINGS.profileBrewing[user.lang]);

  // Generate + send in background — caller doesn't need to await
  void (async () => {
    const { db } = deps;
    const displayName = user.name ?? phone.slice(-4);
    try {
      // Always regenerate on explicit /profile request so users never see stale data.
      const data = await generateProfileCardData(user, deps);
      await db.saveProfileCardData(phone, data);

      const png = await renderProfileCard({
        name: displayName,
        luckyNumber: data.luckyNumber,
        luckyColor: data.luckyColor,
        luckyStone: data.luckyStone,
        millionaireChance: data.millionaireChance,
        meetLoveAge: data.meetLoveAge,
        projection: data.projection,
        shareUrl: SHARE_URL,
      });

      const caption = user.lang === "zh"
        ? `${data.millionaireChance}% 成为百万富翁 · ${data.meetLoveAge} 岁遇见真爱 ✨`
        : `${data.millionaireChance}% chance you're a future millionaire · love hits at ${data.meetLoveAge} ✨`;
      await sendCard(phone, caption, png);
    } catch (err) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: "ERROR", msg: "sendProfileCard", phone: phone.slice(-4), err: String(err) }));
      try {
        await sendText(phone, user.lang === "zh"
          ? "卦盘遇到点小问题，稍后再发 /profile 试试！"
          : "the stars fumbled that one 😭 try /profile again in a sec!");
      } catch { /* best-effort */ }
    }
  })();
}

/** Called once at onboarding completion. Generates + stores profile card data, sends the card,
 *  then arms the daily card scheduler for 8am local time. */
async function prepareAndSendProfileCard(phone: string, user: import("./db.ts").UserRow, deps: RouterDeps): Promise<void> {
  const { db } = deps;

  // Arm daily card first — card render failure must not block scheduling
  if (user.birth_tz) {
    const nextAt = nextEightAmUtc(user.birth_tz, Date.now());
    await db.enableDailyCard(phone, nextAt);
  }

  try {
    const data = await generateProfileCardData(user, deps);
    await db.saveProfileCardData(phone, data);

    const displayName = user.name ?? phone.slice(-4);
    const png = await renderProfileCard({
      name: displayName,
      luckyNumber: data.luckyNumber,
      luckyColor: data.luckyColor,
      luckyStone: data.luckyStone,
      millionaireChance: data.millionaireChance,
      meetLoveAge: data.meetLoveAge,
      projection: data.projection,
      shareUrl: SHARE_URL,
    });

    const caption = user.lang === "zh"
      ? `${data.millionaireChance}% 成为百万富翁 · ${data.meetLoveAge} 岁遇见真爱 ✨`
      : `${data.millionaireChance}% chance you're a future millionaire · love hits at ${data.meetLoveAge} ✨`;
    await sendCard(phone, caption, png);
  } catch (err) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: "ERROR", msg: "prepareProfileCard", phone: phone.slice(-4), err: String(err) }));
    // Notify the user so they're not left in silence
    try {
      const refreshed = await deps.db.getUser(phone);
      const lang = refreshed?.lang ?? "en";
      const msg = lang === "zh"
        ? "卦盘正在生成中，稍后发 /profile 来查看！"
        : "your profile card is still brewing ✨ send /profile whenever you're ready!";
      await sendText(phone, msg);
    } catch { /* best-effort */ }
  }
}

async function generateProfileCardData(user: import("./db.ts").UserRow, deps: RouterDeps): Promise<import("./db.ts").ProfileCardData> {
  const { llm } = deps;
  const bazi = JSON.parse(user.bazi_pillars!);
  const [luckyAttrs, projectionRaw] = await Promise.all([
    llm.getLuckyAttributes(bazi, user.lang),
    llm.getProfileProjection({ bazi, name: user.name, lang: user.lang }),
  ]);
  const projection = trimProjection(projectionRaw, user.lang);

  return {
    luckyNumber: luckyAttrs.number,
    luckyColor: luckyAttrs.color,
    luckyStone: luckyAttrs.stone,
    millionaireChance: luckyAttrs.millionaireChance,
    meetLoveAge: luckyAttrs.meetLoveAge,
    projection,
  };
}

/** Returns the UTC epoch ms for the next 8:00 AM in the given UTC offset string (e.g. "+08:00"). */
export function nextEightAmUtc(tzOffset: string, fromMs: number): number {
  const sign = tzOffset[0] === "+" ? 1 : -1;
  const [h, m] = tzOffset.slice(1).split(":").map(Number);
  const offsetMs = sign * ((h ?? 0) * 60 + (m ?? 0)) * 60 * 1000;

  const localMs = fromMs + offsetMs;
  const d = new Date(localMs);
  const localMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const local8am = localMidnight + 8 * 3600 * 1000;
  const target = local8am > localMs ? local8am : local8am + 24 * 3600 * 1000;
  return target - offsetMs;
}

