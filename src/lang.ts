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
  welcome: {
    en: "Welcome to 运. To cast your readings, I need three things. First — what's your birth date? (e.g., October 22, 2002 or 2002-10-22)",
    zh: "欢迎来到运。帮我确认三件事，才能起卦。首先——你的出生日期是什么？（如：2002年10月22日 或 2002-10-22）",
  },
  askTime: {
    en: "Got it. What time were you born? (e.g., 6:00 PM or 18:00) — or say 'skip' if you don't know.",
    zh: "好的。你的出生时间是几点？（如：18:00 或 下午6点）——不知道的话回「跳过」。",
  },
  askLocation: {
    en: "And where were you born? (city + country, e.g., Shanghai, China)",
    zh: "你在哪里出生？（城市+国家，如：中国深圳）",
  },
  askTimezone: {
    en: "I don't have that city in my lookup table. What's your UTC timezone offset? (e.g., +08:00 for China, -05:00 for NYC)",
    zh: "我没找到那个城市。请输入你的时区偏移？（如中国 +08:00，纽约 -05:00）",
  },
  onboardingComplete: {
    en: "Got it — your 八字 is set. Ask me anything.",
    zh: "好了——八字已记录。随时问卦。",
  },
  invalidDate: {
    en: "I couldn't read that as a date. Try: 2002-10-22 or October 22, 2002.",
    zh: "无法识别这个日期，试试：2002-10-22 或 2002年10月22日。",
  },
  invalidTime: {
    en: "I couldn't read that as a time. Try: 18:00 or 6:00 PM. Or say 'skip'.",
    zh: "无法识别这个时间，试试：18:00 或 下午6点。或者回「跳过」。",
  },
  rateLimited: {
    en: "you've asked 10 times today — come back tomorrow.",
    zh: "今天已问了10次——明天再来吧。",
  },
  deletePrompt: {
    en: "This will permanently delete all your readings and your 八字. Reply 'confirm delete' to proceed, or anything else to cancel.",
    zh: "这将永久删除你的所有卦象和八字数据。回「confirm delete」确认，或回其他内容取消。",
  },
  deleteConfirmed: {
    en: "Done. All your data has been deleted.",
    zh: "已删除。你的所有数据已清除。",
  },
  deleteCancelled: {
    en: "Cancelled.",
    zh: "已取消。",
  },
  sharePrompt: {
    en: "this was a hit. want a shareable card? — reply 'share' and I'll send you one.",
    zh: "这次准了。要生成一张分享卡吗？回「分享」我就发给你。",
  },
  followUpNote: {
    en: "(reply 'yes', 'no', or 'mixed' in a few days when I check back.)",
    zh: "（过几日我来问结果，届时回 yes / no / mixed 即可。）",
  },
} as const;
