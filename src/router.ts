// src/router.ts
import type { Db, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import { detectLang, STRINGS } from "./lang.ts";
import { handleOnboarding } from "./onboarding.ts";
import { handleCommand } from "./commands.ts";
import { parseOutcome, looksLikeOutcome, isShareRequest } from "./outcomes.ts";
import { runQuery } from "./query.ts";
import { renderProfileCard, renderDailyReadingCard, renderSocialCard } from "./card/render.ts";
import { sendText, sendCard, sendShareInvite } from "./spectrum/send.ts";
import { config } from "./config.ts";

const OUTCOME_WINDOW_MS = 48 * 60 * 60 * 1000;
const SHARE_URL = "https://yearn-three.vercel.app/";

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
    await sendText(phone, STRINGS.askName[lang]);
    return;
  }

  await db.touchLastSeen(phone, now);

  // Greeting from a fully onboarded user → welcome back
  if (GREETING_PATTERNS.test(trimmed) && user.onboarding_state === "complete") {
    const name = user.name ? `, ${user.name}` : "";
    const msg = user.lang === "zh"
      ? `欢迎回来${name}！✨ 有什么想问宇宙的吗？`
      : `welcome back${name}! ✨ what do you want to ask the universe today?`;
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
      // Fire-and-forget: generate profile card data + send card, then arm daily scheduler
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
      await sendCard(phone, "🎯 called it.", png);
      await db.markShared(yesOutcome.reading_id);
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

/** Called on /profile — reads cached data from DB, renders with Playwright, sends. No LLM. */
async function sendProfileCard(phone: string, user: import("./db.ts").UserRow, deps: RouterDeps): Promise<void> {
  const { db } = deps;
  const displayName = user.name ?? phone.slice(-4);

  if (!user.bazi_pillars) {
    await sendText(phone, user.lang === "zh"
      ? "还没有八字数据哦，先完成设置吧～ 发「/setup」开始"
      : "no 八字 on file yet — send /setup to get started!");
    return;
  }

  // Use cached profile card data if available; otherwise regenerate it now.
  let data: import("./db.ts").ProfileCardData | null = user.profile_card_json
    ? (JSON.parse(user.profile_card_json) as import("./db.ts").ProfileCardData)
    : null;

  if (!data) {
    try {
      data = await generateProfileCardData(user, deps);
      await db.saveProfileCardData(phone, data);
    } catch {
      const msg = user.lang === "zh"
        ? "正在生成你的卦盘，稍后再试 /profile 就好！"
        : "still working on your profile card — try /profile again in a moment!";
      await sendText(phone, msg);
      return;
    }
  }

  const png = await renderProfileCard({
    name: displayName,
    luckyNumber: data.luckyNumber,
    luckyColor: data.luckyColor,
    luckyStone: data.luckyStone,
    projection: data.projection,
    shareUrl: SHARE_URL,
  });

  const caption = user.lang === "zh"
    ? `幸运数字 ${data.luckyNumber} · 幸运色 ${data.luckyColor} · 幸运石 ${data.luckyStone}`
    : `lucky number ${data.luckyNumber} · lucky color ${data.luckyColor} · lucky stone ${data.luckyStone}`;
  await sendCard(phone, caption, png);
}

/** Called once at onboarding completion. Generates + stores profile card data, sends the card,
 *  then arms the daily card scheduler for 8am local time. */
async function prepareAndSendProfileCard(phone: string, user: import("./db.ts").UserRow, deps: RouterDeps): Promise<void> {
  const { db } = deps;
  try {
    const data = await generateProfileCardData(user, deps);
    await db.saveProfileCardData(phone, data);

    const displayName = user.name ?? phone.slice(-4);
    const png = await renderProfileCard({
      name: displayName,
      luckyNumber: data.luckyNumber,
      luckyColor: data.luckyColor,
      luckyStone: data.luckyStone,
      projection: data.projection,
    });

    const caption = user.lang === "zh"
      ? `幸运数字 ${data.luckyNumber} · 幸运色 ${data.luckyColor} · 幸运石 ${data.luckyStone}`
      : `lucky number ${data.luckyNumber} · lucky color ${data.luckyColor} · lucky stone ${data.luckyStone}`;
    await sendCard(phone, caption, png);

    // Arm daily card delivery at next 8am local time
    if (user.birth_tz) {
      const nextAt = nextEightAmUtc(user.birth_tz, Date.now());
      await db.enableDailyCard(phone, nextAt);
    }
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
  const { db, llm } = deps;
  const bazi = JSON.parse(user.bazi_pillars!);
  const recentReadings = await db.getRecentReadings(user.phone, 3);
  const [luckyAttrs, projection] = await Promise.all([
    llm.getLuckyAttributes(bazi, user.lang),
    llm.interpret({
      question: user.lang === "zh" ? "请给我一个关于近期整体运势的宏观解读。" : "Give me a broad projection of my overall fortune for the near future.",
      lang: user.lang,
      kernel: {},
      user,
      recent: recentReadings,
    }),
  ]);
  return {
    luckyNumber: luckyAttrs.number,
    luckyColor: luckyAttrs.color,
    luckyStone: luckyAttrs.stone,
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
