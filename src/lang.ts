export type Lang = "en" | "zh";

const CJK = /[㐀-鿿豈-﫿\u{20000}-\u{2a6df}]/u;

export function detectLang(text: string): Lang {
  if (!text) return "en";
  const chars = Array.from(text);
  const cjk = chars.filter((c) => CJK.test(c)).length;
  return cjk / chars.length > 0.3 ? "zh" : "en";
}

export const TZ_MAP: Record<string, string> = {
  "shanghai": "+08:00", "beijing": "+08:00", "shenzhen": "+08:00",
  "guangzhou": "+08:00", "chengdu": "+08:00", "chongqing": "+08:00",
  "hangzhou": "+08:00", "wuhan": "+08:00", "nanjing": "+08:00",
  "tianjin": "+08:00", "xi'an": "+08:00", "xian": "+08:00",
  "hong kong": "+08:00", "hongkong": "+08:00",
  "taipei": "+08:00", "singapore": "+08:00",
  "tokyo": "+09:00", "osaka": "+09:00", "kyoto": "+09:00",
  "seoul": "+09:00", "busan": "+09:00",
  "new york": "-05:00", "nyc": "-05:00", "boston": "-05:00",
  "miami": "-05:00", "toronto": "-05:00", "montreal": "-05:00",
  "chicago": "-06:00", "dallas": "-06:00", "houston": "-06:00",
  "minneapolis": "-06:00", "winnipeg": "-06:00",
  "denver": "-07:00", "phoenix": "-07:00", "calgary": "-07:00",
  "los angeles": "-08:00", "la": "-08:00", "san francisco": "-08:00",
  "sf": "-08:00", "seattle": "-08:00", "vancouver": "-08:00",
  "portland": "-08:00", "san diego": "-08:00", "las vegas": "-08:00",
  "sacramento": "-08:00", "san jose": "-08:00",
  "london": "+00:00", "dublin": "+00:00", "lisbon": "+00:00",
  "paris": "+01:00", "berlin": "+01:00", "amsterdam": "+01:00",
  "rome": "+01:00", "madrid": "+01:00", "barcelona": "+01:00",
  "stockholm": "+01:00", "oslo": "+01:00", "zurich": "+01:00",
  "vienna": "+01:00", "brussels": "+01:00", "munich": "+01:00",
  "moscow": "+03:00", "istanbul": "+03:00",
  "dubai": "+04:00", "abu dhabi": "+04:00",
  "karachi": "+05:00",
  "mumbai": "+05:30", "delhi": "+05:30", "bangalore": "+05:30",
  "kolkata": "+05:30", "chennai": "+05:30", "hyderabad": "+05:30",
  "dhaka": "+06:00",
  "bangkok": "+07:00", "jakarta": "+07:00", "hanoi": "+07:00",
  "kuala lumpur": "+08:00", "kl": "+08:00", "manila": "+08:00",
  "perth": "+08:00",
  "sydney": "+11:00", "melbourne": "+11:00", "brisbane": "+10:00",
  "auckland": "+13:00", "wellington": "+13:00",
};

export function resolveTimezone(location: string): string | null {
  const t = location.trim();
  // Raw offset passthrough e.g. "+08:00"
  if (/^[+-]\d{2}:\d{2}$/.test(t)) return t;
  // Normalize: lowercase and strip punctuation so "L.A." → "la", "Hong-Kong" → "hong kong"
  const lower = t.toLowerCase().replace(/[.\-_,;!?]/g, " ").replace(/\s+/g, " ").trim();
  for (const [k, v] of Object.entries(TZ_MAP)) {
    if (lower.includes(k)) return v;
  }
  return null;
}

export const STRINGS = {
  askName: {
    en: "hey!! welcome to yearn ✨ your personal fortune bestie. what's your name?",
    zh: "嗨！欢迎来到 yearn ✨ 你的专属运势小助手。你叫什么名字？",
  },
  askNameFromLanding: {
    en: "hey!! you made it from the landing page ✨ let's build your fortune profile — what's your name?",
    zh: "嗨！从主页来的 ✨ 我们来建立你的运势档案——你叫什么名字？",
  },
  profileBrewing: {
    en: "brewing your profile card ✨ i'll send it your way when it's ready!",
    zh: "卦盘正在生成中 ✨ 好了马上发给你！",
  },
  shareNoOutcome: {
    en: "no verified wins to share yet ✨ ask the universe something first, then reply yes when it hits!",
    zh: "还没有可分享的应验结果 ✨ 先问宇宙一个问题，应验了回 yes 就能分享啦！",
  },
  specificQuestionNote: {
    en: "\n\n(ps — your daily reading card drops every morning at 8am ✨)",
    zh: "\n\n（小提示：每日运势卡会在早上 8 点自动发送 ✨）",
  },
  welcome: {
    en: "love that!! now drop your birthday so i can read your 八字 (e.g. Apr 7, 2004 or 2004-04-07)",
    zh: "好名字！告诉我你的生日，我来算你的八字（如：2004年4月7日 或 2004-04-07）",
  },
  askTime: {
    en: "got it! what time were you born? (e.g. 9:30 AM or 14:00) — say 'skip' if you're not sure",
    zh: "明白！你几点出生？（如：14:00 或 上午9点半）——不确定就回「跳过」",
  },
  askLocation: {
    en: "almost there! where were you born? (city is fine, like LA or Shanghai)",
    zh: "快好啦！你在哪里出生？（说城市就好，比如深圳或上海）",
  },
  askTimezone: {
    en: "hmm that city's not in my atlas yet 🗺️ drop your UTC offset and we're good — e.g. +08:00 for China, -05:00 for NYC, -08:00 for LA",
    zh: "哎，暂时没这个城市的数据！告诉我时区就好——如中国 +08:00，纽约 -05:00，洛杉矶 -08:00",
  },
  onboardingComplete: {
    en: "ur 八字 is locked in ✨ your profile card is on its way! ask me anything — the universe is ready to spill",
    zh: "八字已解锁 ✨ 个人卦盘正在发送！随时来问，宇宙随时回答",
  },
  invalidDate: {
    en: "hmm couldn't read that date 🤔 try something like: Oct 22, 2002 or 2002-10-22",
    zh: "没认出这个日期，试试：2002-10-22 或 2002年10月22日",
  },
  invalidTime: {
    en: "couldn't catch that time — try: 18:00 or 6:00 PM, or say 'skip' if you're not sure",
    zh: "没认出这个时间，试试：18:00 或 下午6点，或回「跳过」",
  },
  rateLimited: {
    en: "bestie you've been asking a LOT today 😭 the stars need a breather — come back tomorrow!",
    zh: "今天问了很多啦，宇宙需要休息一下——明天见！",
  },
  deletePrompt: {
    en: "wait bestie 🫣 this deletes everything — your 八字 and all your readings. reply 'confirm delete' to go through with it, or anything else to cancel.",
    zh: "等等！这将删除一切——你的八字和所有卦象。回「confirm delete」确认，或回其他内容取消。",
  },
  deleteConfirmed: {
    en: "all cleared ✨ start fresh whenever — yearn will be here.",
    zh: "全部清除了。随时可以重新开始，yearn 一直在这里。",
  },
  deleteCancelled: {
    en: "okay phew, nothing changed 😮‍💨",
    zh: "什么都没变，放心！",
  },
  sharePrompt: {
    en: "the universe literally called it ✨ want a shareable card? reply 'share'",
    zh: "宇宙真的说对了！要生成分享卡吗？回「分享」",
  },
  outcomeYes: {
    en: "IT CAME TRUE 🎯 the universe understood the assignment. logged!",
    zh: "应验了 🎯 宇宙没让你失望！记下来了",
  },
  outcomeNo: {
    en: "logged: it didn't 🌑 cosmic misses are rare — it usually means the energy shifted before it could land. the universe is recalibrating. ask again whenever you're ready ✨",
    zh: "记下来了：这次没准 🌑 宇宙偶尔也会跑偏——通常意味着能量在落地前就转移了。宇宙正在重新校准，随时可以再来问 ✨",
  },
  outcomeMixed: {
    en: "logged: mixed 🌗 half the cosmos showed up — that's still a reading! add context anytime by replying 'mixed [what happened]'",
    zh: "记下来了：一半一半 🌗 宇宙说对了一半——这也算数！想补充细节就回「mixed 发生了什么」",
  },
  followUpNote: {
    en: "(i'll check back when the time comes — reply yes / no / mixed!)",
    zh: "（到时候我会来问结果的——回 yes / no / mixed！）",
  },
} as const;
