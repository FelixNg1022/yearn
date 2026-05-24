// src/commands.ts
import type { Db, UserRow } from "./db.ts";
import type { Lang } from "./lang.ts";
import { STRINGS } from "./lang.ts";

export interface CommandResult {
  reply: string;
  sideEffect?: "set_delete_pending" | "render_profile_card";
}

export async function handleCommand(
  text: string,
  user: UserRow,
  db: Db,
): Promise<CommandResult> {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1);
  const lang: Lang = user.lang;

  switch (cmd) {
    case "/help":
      return { reply: help(lang) };

    case "/history":
      return { reply: await history(user, db) };

    case "/stats":
      return { reply: await stats(user, db) };

    case "/methods":
      return { reply: methods(lang) };

    case "/lang": {
      const arg = args[0]?.toLowerCase();
      if (arg !== "en" && arg !== "zh") {
        return { reply: lang === "zh" ? "试试 /lang en 或 /lang zh" : "try /lang en or /lang zh ✨" };
      }
      await db.setUserLang(user.phone, arg);
      return { reply: arg === "zh" ? "切换到中文啦 ✨" : "switching to english, got it ✨" };
    }

    case "/profile":
      return { reply: "__RENDER_PROFILE_CARD__", sideEffect: "render_profile_card" };

    case "/setup":
      await db.setOnboardingState(user.phone, "pending_name");
      return { reply: STRINGS.askName[lang] };

    case "/delete":
      await db.setDeletePending(user.phone, 1);
      return { reply: STRINGS.deletePrompt[lang] };

    default:
      return { reply: lang === "zh" ? "不认识这个命令，试试 /help 看看有啥～" : "hmm i don't know that one — try /help for the full list ✨" };
  }
}

function help(lang: Lang): string {
  if (lang === "zh") {
    return [
      "yearn — 命令一览",
      "/help        这条帮助",
      "/profile     查看你的个人卦盘",
      "/history     最近 5 次卦",
      "/stats       总次数 + 应验率",
      "/methods     三种方法简介",
      "/lang en|zh  切换语言",
      "/setup       重新录入八字",
      "/delete      删除所有数据",
      "",
      "直接发问题即可。含「小六壬 / liuren」切到小六壬。",
      "具体 yes/no 问题 → 文字概率解读；开放式问题 → 完整运势卡。",
    ].join("\n");
  }
  return [
    "yearn — commands",
    "/help        this message",
    "/profile     view your profile card",
    "/history     last 5 readings",
    "/stats       total count + hit rate",
    "/methods     short intro to each method",
    "/lang en|zh  switch language",
    "/setup       re-enter your 八字",
    "/delete      delete all your data",
    "",
    "just text a question. include '小六壬' or 'liuren' for 小六壬 method.",
    "specific yes/no questions → text probability read. open-ended vibes → full fortune card.",
  ].join("\n");
}

async function history(user: UserRow, db: Db): Promise<string> {
  const recent = await db.getRecentReadings(user.phone, 5);
  if (recent.length === 0) {
    return user.lang === "zh" ? "还没问过卦呢，发个问题试试吧 ✨" : "no readings yet — ask the universe something ✨";
  }
  return recent.map((r, i) => {
    const date = new Date(r.created_at).toISOString().slice(0, 10);
    const q = r.question.length > 48 ? r.question.slice(0, 45) + "…" : r.question;
    return `${i + 1}. [${date}] ${r.method} · "${q}"`;
  }).join("\n");
}

async function stats(user: UserRow, db: Db): Promise<string> {
  const s = await db.getStats(user.phone);
  const zh = user.lang === "zh";
  if (s.total === 0) return zh ? "还没问过卦呢，发个问题试试吧 ✨" : "no readings yet — ask the universe something ✨";
  const decided = s.yes + s.no;
  const hitRate = decided > 0 ? Math.round((s.yes / decided) * 100) : null;
  const hitLine = hitRate === null
    ? zh ? "应验率：还没有明确结果" : "hit rate: no decided outcomes yet"
    : zh ? `应验率：${hitRate}% （准 ${s.yes} / 不准 ${s.no} / 一半 ${s.mixed}）`
          : `hit rate: ${hitRate}% (yes ${s.yes} / no ${s.no} / mixed ${s.mixed})`;
  return zh
    ? [`总卦数：${s.total}`, `有结果：${s.with_outcome} / ${s.total}`, hitLine].join("\n")
    : [`total readings: ${s.total}`, `with outcome: ${s.with_outcome} / ${s.total}`, hitLine].join("\n");
}

function methods(lang: Lang): string {
  if (lang === "zh") {
    return [
      "三法简介：",
      "• 梅花易数（默认）：根据发问时刻的阴历年月日时推卦。",
      "• 小六壬：月、日、时三宫推演。含「小六壬」或「liuren」切换。",
      "• 八字：入门时算一次，作为所有卦的解读背景。",
    ].join("\n");
  }
  return [
    "methods:",
    "• 梅花易数 (default): hexagram from lunar timestamp of your message.",
    "• 小六壬: three-palace cast. Include '小六壬' or 'liuren' to switch.",
    "• 八字: four pillars computed from birth data — context for every reading.",
  ].join("\n");
}
