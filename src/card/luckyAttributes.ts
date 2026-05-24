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

export interface LuckyAttributes {
  number: number;
  color: LuckyColorName;
  stone: LuckyStone;
  millionaireChance: number;
  meetLoveAge: number;
}

/** Stable 32-bit hash of 八字 JSON — same pillars always yield the same attributes. */
export function hashBazi(bazi: unknown): number {
  const baziStr = JSON.stringify(bazi);
  let h = 0;
  for (let i = 0; i < baziStr.length; i++) {
    h = (Math.imul(31, h) + baziStr.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Derive lucky profile stats deterministically from 八字 — never re-roll on /profile. */
export function deriveLuckyAttributes(bazi: unknown): LuckyAttributes {
  const h = hashBazi(bazi);
  return {
    number: (h % 9) + 1,
    color: VALID_COLORS[h % VALID_COLORS.length]!,
    stone: VALID_STONES[h % VALID_STONES.length]!,
    millionaireChance: 40 + (h % 51),
    meetLoveAge: 22 + (h % 18),
  };
}
