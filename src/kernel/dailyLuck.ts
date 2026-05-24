import { Solar } from "lunar-typescript";
import type { BaziResult, Pillar } from "./bazi.ts";

export type WuXing = "木" | "火" | "土" | "金" | "水";

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

function resourceOf(dm: WuXing): WuXing {
  for (const [src, dst] of Object.entries(GENERATES) as [WuXing, WuXing][]) {
    if (dst === dm) return src;
  }
  throw new Error(`No resource element for ${dm}`);
}

function wealthOf(dm: WuXing): WuXing {
  return CONTROLS[dm];
}

function officerOf(dm: WuXing): WuXing {
  for (const [src, dst] of Object.entries(CONTROLS) as [WuXing, WuXing][]) {
    if (dst === dm) return src;
  }
  throw new Error(`No officer element for ${dm}`);
}

/** How an encountered element interacts with the day master (日主). */
function harmony(dm: WuXing, other: WuXing): number {
  if (other === dm) return 1;
  if (GENERATES[other] === dm) return 2.5;   // 印 — resource / support
  if (GENERATES[dm] === other) return 0.5;   // 食伤 — output / drain
  if (CONTROLS[other] === dm) return -2;      // 官杀 — pressure
  if (CONTROLS[dm] === other) return 1.5;      // 财 — wealth / grasp
  return 0;
}

function pillarTouchScore(dm: WuXing, pillar: Pillar): number {
  const stemScore = harmony(dm, stemEl(pillar.gan));
  const branchScore = harmony(dm, branchEl(pillar.zhi));
  const hiddenAvg = pillar.hide_gan.length === 0
    ? branchScore
    : pillar.hide_gan.reduce((sum, g) => sum + harmony(dm, stemEl(g)), 0) / pillar.hide_gan.length;
  return stemScore * 0.45 + branchScore * 0.35 + hiddenAvg * 0.2;
}

function relationshipScore(user: BaziResult, flow: FlowPillars): number {
  const dayBranch = user.day_pillar.zhi;
  const flowBranch = flow.day_pillar.zhi;
  let raw = pillarTouchScore(user.day_master_element as WuXing, flow.day_pillar) * 0.35;

  if (LIU_HE[dayBranch] === flowBranch) raw += 2.5;
  if (CHONG[dayBranch] === flowBranch) raw -= 3;

  if (PEACH_BLOSSOM.has(flowBranch)) {
    raw += PEACH_BLOSSOM.has(user.year_pillar.zhi) || PEACH_BLOSSOM.has(user.day_pillar.zhi) ? 2 : 1;
  }

  // Spouse palace (日支) resonance with flow month stem
  raw += harmony(stemEl(user.day_pillar.gan), stemEl(flow.month_pillar.gan)) * 0.4;
  return raw;
}

function academicScore(dm: WuXing, flow: FlowPillars): number {
  const seal = resourceOf(dm);
  const scoreFor = (el: WuXing) => (el === seal ? 2.5 : el === dm ? 0.5 : harmony(dm, el));

  const dayStem = scoreFor(stemEl(flow.day_pillar.gan));
  const dayBranch = scoreFor(branchEl(flow.day_pillar.zhi));
  const monthStem = scoreFor(stemEl(flow.month_pillar.gan)) * 0.6;
  const hidden = flow.day_pillar.hide_gan.reduce((sum, g) => sum + scoreFor(stemEl(g)), 0)
    / Math.max(1, flow.day_pillar.hide_gan.length);

  return dayStem * 0.35 + dayBranch * 0.3 + monthStem * 0.2 + hidden * 0.15;
}

function careerScore(dm: WuXing, flow: FlowPillars): number {
  const wealth = wealthOf(dm);
  const officer = officerOf(dm);

  const wealthHits = [flow.day_pillar, flow.month_pillar].reduce((sum, p) => {
    let hit = 0;
    if (stemEl(p.gan) === wealth) hit += 2;
    if (branchEl(p.zhi) === wealth) hit += 1.5;
    for (const g of p.hide_gan) if (stemEl(g) === wealth) hit += 0.75;
    return sum + hit;
  }, 0);

  const officerHits = [flow.day_pillar, flow.month_pillar].reduce((sum, p) => {
    let hit = 0;
    if (stemEl(p.gan) === officer) hit += 1.5;
    if (branchEl(p.zhi) === officer) hit += 1;
    for (const g of p.hide_gan) if (stemEl(g) === officer) hit += 0.5;
    return sum + hit;
  }, 0);

  // Moderate 官杀 supports discipline; excessive officer pressure drags score.
  const officerTerm = officerHits <= 2.5 ? officerHits * 0.9 : 2.5 - (officerHits - 2.5) * 0.8;
  return wealthHits * 0.55 + officerTerm * 0.45 + pillarTouchScore(dm, flow.day_pillar) * 0.25;
}

function generalScore(dm: WuXing, flow: FlowPillars): number {
  const day = pillarTouchScore(dm, flow.day_pillar);
  const month = pillarTouchScore(dm, flow.month_pillar) * 0.65;
  const year = pillarTouchScore(dm, flow.year_pillar) * 0.35;
  return day * 0.55 + month * 0.3 + year * 0.15;
}

/** Map a raw interaction sum to a 1–5 meter score. */
export function rawToLuckScore(raw: number, min = -3, max = 5): number {
  const clamped = Math.max(min, Math.min(max, raw));
  return Math.max(1, Math.min(5, Math.round(((clamped - min) / (max - min)) * 4 + 1)));
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
  const dm = userBazi.day_master_element as WuXing;

  return {
    general: rawToLuckScore(generalScore(dm, flow)),
    relationship: rawToLuckScore(relationshipScore(userBazi, flow)),
    academic: rawToLuckScore(academicScore(dm, flow)),
    career: rawToLuckScore(careerScore(dm, flow)),
    flow,
  };
}
