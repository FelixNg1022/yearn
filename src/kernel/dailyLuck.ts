import { Solar } from "lunar-typescript";
import type { BaziResult, Pillar } from "./bazi.ts";

export type WuXing = "木" | "火" | "土" | "金" | "水";

export type LuckCategory = "general" | "relationship" | "academic" | "career";

export type TenGod =
  | "biJian"
  | "jieCai"
  | "shiShen"
  | "shangGuan"
  | "pianCai"
  | "zhengCai"
  | "qiSha"
  | "zhengGuan"
  | "pianYin"
  | "zhengYin";

export interface FlowPillars {
  calendar: { year: number; month: number; day: number };
  year_pillar: Pillar;
  month_pillar: Pillar;
  day_pillar: Pillar;
}

export interface DailyLuckScores {
  general: number;
  relationship: number;
  academic: number;
  career: number;
  flow: FlowPillars;
}

const STEM_ELEMENT: Readonly<Record<string, WuXing>> = {
  甲: "木", 乙: "木",
  丙: "火", 丁: "火",
  戊: "土", 己: "土",
  庚: "金", 辛: "金",
  壬: "水", 癸: "水",
};

const BRANCH_ELEMENT: Readonly<Record<string, WuXing>> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};

const GENERATES: Readonly<Record<WuXing, WuXing>> = {
  木: "火", 火: "土", 土: "金", 金: "水", 水: "木",
};

const CONTROLS: Readonly<Record<WuXing, WuXing>> = {
  木: "土", 火: "金", 土: "水", 金: "木", 水: "火",
};

const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);
const PEACH_BLOSSOM = new Set(["子", "午", "卯", "酉"]);

const LIU_HE: Readonly<Record<string, string>> = {
  子: "丑", 丑: "子", 寅: "亥", 亥: "寅",
  卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰",
  巳: "申", 申: "巳", 午: "未", 未: "午",
};

const CHONG: Readonly<Record<string, string>> = {
  子: "午", 午: "子", 丑: "未", 未: "丑",
  寅: "申", 申: "寅", 卯: "酉", 酉: "卯",
  辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳",
};

const LIU_HAI: Readonly<Record<string, string>> = {
  子: "未", 未: "子", 丑: "午", 午: "丑",
  寅: "巳", 巳: "寅", 卯: "辰", 辰: "卯",
  申: "亥", 亥: "申", 酉: "戌", 戌: "酉",
};

const NATAL_PILLARS: ReadonlyArray<{ key: keyof BaziResult; weight: number }> = [
  { key: "day_pillar", weight: 1.0 },
  { key: "month_pillar", weight: 0.65 },
  { key: "hour_pillar", weight: 0.55 },
  { key: "year_pillar", weight: 0.4 },
];

const GOD_VALUE: Readonly<Record<TenGod, Readonly<Record<LuckCategory, number>>>> = {
  zhengYin: { general: 2.0, relationship: 0.6, academic: 3.0, career: 0.8 },
  pianYin: { general: 1.4, relationship: 0.2, academic: 2.4, career: 0.4 },
  zhengGuan: { general: 1.0, relationship: 0.5, academic: 0.4, career: 2.6 },
  qiSha: { general: -1.2, relationship: -0.8, academic: -0.6, career: 1.6 },
  zhengCai: { general: 1.6, relationship: 2.4, academic: 0.2, career: 2.2 },
  pianCai: { general: 1.0, relationship: 1.8, academic: 0.0, career: 1.6 },
  shiShen: { general: 1.8, relationship: 1.0, academic: 1.2, career: 0.6 },
  shangGuan: { general: 0.4, relationship: 1.4, academic: -0.8, career: -0.4 },
  biJian: { general: 0.2, relationship: -0.6, academic: 0.2, career: -0.6 },
  jieCai: { general: -0.6, relationship: -1.2, academic: -0.4, career: -1.0 },
};

/** Wall-clock calendar date in a fixed UTC offset (e.g. "+08:00", "-07:00"). */
export function localCalendarParts(at: Date, tzOffset: string): { year: number; month: number; day: number } {
  const sign = tzOffset[0] === "+" ? 1 : -1;
  const [h, m] = tzOffset.slice(1).split(":").map(Number);
  const offsetMs = sign * ((h ?? 0) * 60 + (m ?? 0)) * 60 * 1000;
  const localMs = at.getTime() + offsetMs;
  const d = new Date(localMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function pillarFromEightChar(
  ganZhi: string,
  gan: string,
  zhi: string,
  hideGan: readonly string[],
  wuXing: string,
  naYin: string,
): Pillar {
  return { gan_zhi: ganZhi, gan, zhi, hide_gan: hideGan, wu_xing: wuXing, na_yin: naYin };
}

/** 流日 / 流月 / 流年 pillars for a calendar day (noon local, day pillar stable). */
export function computeFlowPillars(year: number, month: number, day: number): FlowPillars {
  const solar = Solar.fromYmdHms(year, month, day, 12, 0, 0);
  const ec = solar.getLunar().getEightChar();
  return {
    calendar: { year, month, day },
    year_pillar: pillarFromEightChar(
      ec.getYear(), ec.getYearGan(), ec.getYearZhi(),
      ec.getYearHideGan(), ec.getYearWuXing(), ec.getYearNaYin(),
    ),
    month_pillar: pillarFromEightChar(
      ec.getMonth(), ec.getMonthGan(), ec.getMonthZhi(),
      ec.getMonthHideGan(), ec.getMonthWuXing(), ec.getMonthNaYin(),
    ),
    day_pillar: pillarFromEightChar(
      ec.getDay(), ec.getDayGan(), ec.getDayZhi(),
      ec.getDayHideGan(), ec.getDayWuXing(), ec.getDayNaYin(),
    ),
  };
}

function stemEl(stem: string): WuXing {
  const e = STEM_ELEMENT[stem];
  if (!e) throw new Error(`Unknown heavenly stem: ${stem}`);
  return e;
}

function branchEl(branch: string): WuXing {
  const e = BRANCH_ELEMENT[branch];
  if (!e) throw new Error(`Unknown earthly branch: ${branch}`);
  return e;
}

function isYang(stem: string): boolean {
  return YANG_STEMS.has(stem);
}

/** 十神 of `other` relative to the day master stem. */
export function tenGod(dayMaster: string, other: string): TenGod {
  const dmEl = stemEl(dayMaster);
  const otherEl = stemEl(other);
  const samePol = isYang(dayMaster) === isYang(other);

  if (dmEl === otherEl) return samePol ? "biJian" : "jieCai";
  if (GENERATES[dmEl] === otherEl) return samePol ? "shiShen" : "shangGuan";
  if (CONTROLS[dmEl] === otherEl) return samePol ? "pianCai" : "zhengCai";
  if (CONTROLS[otherEl] === dmEl) return samePol ? "qiSha" : "zhengGuan";
  if (GENERATES[otherEl] === dmEl) return samePol ? "pianYin" : "zhengYin";
  throw new Error(`No ten-god relation between ${dayMaster} and ${other}`);
}

function godContribution(dayMaster: string, stem: string, category: LuckCategory, weight: number): number {
  return GOD_VALUE[tenGod(dayMaster, stem)][category] * weight;
}

function branchHarmony(dm: WuXing, branch: string): number {
  const other = branchEl(branch);
  if (other === dm) return 0.8;
  if (GENERATES[other] === dm) return 1.6;
  if (GENERATES[dm] === other) return 0.4;
  if (CONTROLS[other] === dm) return -1.4;
  if (CONTROLS[dm] === other) return 1.0;
  return 0;
}

function branchInteraction(
  natalZhi: string,
  flowZhi: string,
  category: LuckCategory,
): number {
  if (natalZhi === flowZhi) {
    return category === "relationship" ? 0.8 : 0.5;
  }
  if (LIU_HE[natalZhi] === flowZhi) {
    return category === "relationship" ? 2.8 : 1.4;
  }
  if (CHONG[natalZhi] === flowZhi) {
    return category === "relationship" ? -2.8 : -1.6;
  }
  if (LIU_HAI[natalZhi] === flowZhi) {
    return category === "relationship" ? -1.4 : -0.8;
  }
  if (category === "relationship" && PEACH_BLOSSOM.has(flowZhi)) {
    return PEACH_BLOSSOM.has(natalZhi) ? 1.8 : 1.0;
  }
  return 0;
}

function scoreFlowStem(
  dayMaster: string,
  flowStem: string,
  category: LuckCategory,
  weight: number,
): number {
  return godContribution(dayMaster, flowStem, category, weight);
}

function scoreFlowPillarAgainstNatal(
  user: BaziResult,
  flowPillar: Pillar,
  flowWeight: number,
  category: LuckCategory,
): number {
  const dm = user.day_master;
  let raw = 0;

  raw += scoreFlowStem(dm, flowPillar.gan, category, flowWeight * 1.0);

  for (const { key, weight } of NATAL_PILLARS) {
    const natal = user[key] as Pillar;
    raw += godContribution(dm, flowPillar.gan, category, flowWeight * weight * 0.35)
      * (natal.gan === flowPillar.gan ? 1.2 : 1);
    raw += branchInteraction(natal.zhi, flowPillar.zhi, category) * weight;
    raw += branchHarmony(stemEl(dm), flowPillar.zhi) * weight * 0.25;
    for (const hidden of flowPillar.hide_gan) {
      raw += godContribution(dm, hidden, category, flowWeight * weight * 0.12);
    }
  }

  return raw;
}

function scoreCategory(user: BaziResult, flow: FlowPillars, category: LuckCategory): number {
  let raw = 0;
  raw += scoreFlowPillarAgainstNatal(user, flow.day_pillar, 1.15, category);
  raw += scoreFlowPillarAgainstNatal(user, flow.month_pillar, 0.55, category);
  raw += scoreFlowPillarAgainstNatal(user, flow.year_pillar, 0.25, category);

  // Day master vs flow day branch element (日支气)
  raw += branchHarmony(stemEl(user.day_master), flow.day_pillar.zhi) * 0.9;

  return raw;
}

/** Map a raw 十神 interaction sum to a 1–5 meter score. */
export function rawToLuckScore(raw: number): number {
  const score = 3 + raw * 0.30;
  return Math.max(1, Math.min(5, Math.round(score)));
}

/**
 * Compute today's four luck meters from the user's natal 八字 and the
 * requested calendar day in their timezone.
 */
export function computeDailyLuck(
  userBazi: BaziResult,
  at: Date,
  tzOffset: string,
): DailyLuckScores {
  const cal = localCalendarParts(at, tzOffset);
  const flow = computeFlowPillars(cal.year, cal.month, cal.day);

  return {
    general: rawToLuckScore(scoreCategory(userBazi, flow, "general")),
    relationship: rawToLuckScore(scoreCategory(userBazi, flow, "relationship")),
    academic: rawToLuckScore(scoreCategory(userBazi, flow, "academic")),
    career: rawToLuckScore(scoreCategory(userBazi, flow, "career")),
    flow,
  };
}
