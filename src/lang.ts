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
  "portland": "-08:00", "san diego": "-08:00",
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
  const lower = t.toLowerCase();
  for (const [k, v] of Object.entries(TZ_MAP)) {
    if (lower.includes(k)) return v;
  }
  return null;
}

export const STRINGS = {
  askName: {
    en: "omg hi!! welcome to 运 (yun) — your personal fortune bestie. what's your name?",
    zh: "嗨嗨！欢迎来到运✨ 你的专属命运小助手。你叫什么名字呀？",
  },
  welcome: {
    en: "love that name! now drop your birthday so i can read your 八字 (e.g. Oct 22, 2002 or 2002-10-22)",
    zh: "好名字！告诉我你的生日，我来算你的八字～（如：2002年10月22日 或 2002-10-22）",
  },
  askTime: {
    en: "got it! what time were you born? (e.g. 6:00 PM or 18:00) — say 'skip' if you're not sure, no worries!",
    zh: "明白了！你几点出生的？（如：18:00 或 下午6点）——不确定就回「跳过」，没关系的！",
  },
  askLocation: {
    en: "almost done! where were you born? (city is fine, like LA or Shanghai)",
    zh: "快好啦！你在哪里出生？（说城市就好，比如深圳或上海）",
  },
  askTimezone: {
    en: "hmm i don't have that city yet! what's your UTC offset? (e.g. +08:00 for China, -05:00 for NYC)",
    zh: "哎呀，暂时没有这个城市的数据！能告诉我你的时区吗？（如中国 +08:00，纽约 -05:00）",
  },
  onboardingComplete: {
    en: "ur 八字 is locked in and your profile card is on its way! ask me anything and the universe will spill fr",
    zh: "八字已解锁，个人卦盘正在发送！随时来问卦，宇宙会告诉你答案的",
  },
  invalidDate: {
    en: "hmm couldn't read that date! try: 2002-10-22 or Oct 22, 2002",
    zh: "哎没认出这个日期！试试：2002-10-22 或 2002年10月22日",
  },
  invalidTime: {
    en: "couldn't read that time! try: 18:00 or 6:00 PM — or just say 'skip' bestie",
    zh: "没认出这个时间！试试：18:00 或 下午6点 — 或者回「跳过」也行",
  },
  rateLimited: {
    en: "bestie you've asked 10 times today lol the stars need a breather — come back tomorrow!",
    zh: "今天已经问了10次啦哈哈哈 宇宙也要休息一下——明天见！",
  },
  deletePrompt: {
    en: "this will delete everything — your 八字 and all readings. reply 'confirm delete' to proceed, or anything else to cancel",
    zh: "这将删除一切——你的八字和所有卦象。回「confirm delete」确认，或回其他内容取消",
  },
  deleteConfirmed: {
    en: "done! all gone. start fresh anytime, we'll be here",
    zh: "搞定！全部清除了。随时可以重新开始哦",
  },
  deleteCancelled: {
    en: "phew! nothing happened, all good",
    zh: "好的！什么都没变，放心",
  },
  sharePrompt: {
    en: "the universe literally called it! want a shareable card? reply 'share' and i'll make you one",
    zh: "宇宙真的说对了！要生成一张分享卡吗？回「分享」我来给你做一张",
  },
  followUpNote: {
    en: "(i'll check back when the time comes — reply yes / no / mixed and let me know how it played out!)",
    zh: "（到时候我会来问结果的——回 yes / no / mixed 告诉我怎么样了！）",
  },
} as const;
