import { VALID_STONES, type LuckyStone } from "./stones.ts";

export const VALID_COLORS = [
  "orange",
  "marigold",
  "rose",
  "magenta",
  "violet",
  "azure",
  "teal",
  "lime",
] as const;

export type LuckyColorName = (typeof VALID_COLORS)[number];

export interface CoreLuckyAttributes {
  number: number;
  color: LuckyColorName;
  stone: LuckyStone;
}

export interface LuckyAttributes extends CoreLuckyAttributes {
  millionaireChance: number;
  meetLoveAge: number;
}

/** Bump when profile stats generation logic changes — triggers one-time LLM refresh. */
export const PROFILE_STATS_VERSION = 2;

/** Stable 32-bit hash of 八字 JSON — same pillars always yield the same attributes. */
export function hashBazi(bazi: unknown): number {
  const baziStr = JSON.stringify(bazi);
  let h = 0;
  for (let i = 0; i < baziStr.length; i++) {
    h = (Math.imul(31, h) + baziStr.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Derive lucky number, color, and stone deterministically from 八字. */
export function deriveCoreLuckyAttributes(bazi: unknown): CoreLuckyAttributes {
  const h = hashBazi(bazi);
  return {
    number: (h % 9) + 1,
    color: VALID_COLORS[h % VALID_COLORS.length]!,
    stone: VALID_STONES[h % VALID_STONES.length]!,
  };
}

/** Hash fallback for profile stats when the LLM call fails. Uses distinct bit ranges. */
export function deriveProfileStatsFallback(bazi: unknown): { millionaireChance: number; meetLoveAge: number } {
  const h = hashBazi(bazi);
  return {
    millionaireChance: 35 + ((h >>> 8) % 58),
    meetLoveAge: 20 + ((h >>> 16) % 21),
  };
}

/** @deprecated Use deriveCoreLuckyAttributes + LLM profile stats instead. */
export function deriveLuckyAttributes(bazi: unknown) {
  const core = deriveCoreLuckyAttributes(bazi);
  const stats = deriveProfileStatsFallback(bazi);
  return { ...core, ...stats };
}
