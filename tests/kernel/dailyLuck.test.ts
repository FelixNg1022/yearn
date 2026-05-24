import { describe, expect, test } from "bun:test";
import { computeBazi } from "../../src/kernel/bazi.ts";
import {
  computeDailyLuck,
  computeFlowPillars,
  localCalendarParts,
  rawToLuckScore,
} from "../../src/kernel/dailyLuck.ts";

describe("localCalendarParts", () => {
  test("maps UTC instant to wall-clock date in +08:00", () => {
    // 2026-05-24 23:30 UTC = 2026-05-25 07:30 in Shanghai
    const at = new Date("2026-05-24T23:30:00.000Z");
    expect(localCalendarParts(at, "+08:00")).toEqual({ year: 2026, month: 5, day: 25 });
  });
});

describe("computeFlowPillars", () => {
  test("is deterministic for the same calendar day", () => {
    const a = computeFlowPillars(2026, 5, 24);
    const b = computeFlowPillars(2026, 5, 24);
    expect(a.day_pillar.gan_zhi).toBe(b.day_pillar.gan_zhi);
  });
});

describe("computeDailyLuck", () => {
  const felix = computeBazi("2002-10-22T18:00:00+08:00");

  test("same 八字 + same local calendar day → identical scores", () => {
    const morning = new Date("2026-05-24T15:00:00.000Z"); // 08:00 PDT
    const evening = new Date("2026-05-25T06:59:00.000Z"); // 23:59 PDT same local day
    const a = computeDailyLuck(felix, morning, "-07:00");
    const b = computeDailyLuck(felix, evening, "-07:00");
    expect(a.general).toBe(b.general);
    expect(a.relationship).toBe(b.relationship);
    expect(a.academic).toBe(b.academic);
    expect(a.career).toBe(b.career);
  });

  test("different calendar days can change scores", () => {
    const day1 = computeDailyLuck(felix, new Date("2026-05-24T15:00:00.000Z"), "-07:00");
    const day2 = computeDailyLuck(felix, new Date("2026-05-25T15:00:00.000Z"), "-07:00");
    const same =
      day1.general === day2.general &&
      day1.relationship === day2.relationship &&
      day1.academic === day2.academic &&
      day1.career === day2.career;
    expect(same).toBe(false);
  });

  test("different 八字 on the same day yields different scores", () => {
    const other = computeBazi("1998-03-15T09:30:00+08:00");
    const at = new Date("2026-05-24T15:00:00.000Z");
    const a = computeDailyLuck(felix, at, "-07:00");
    const b = computeDailyLuck(other, at, "-07:00");
    expect(a).not.toEqual(b);
  });

  test("all scores are integers from 1 to 5", () => {
    const luck = computeDailyLuck(felix, new Date("2026-05-24T15:00:00.000Z"), "-07:00");
    for (const key of ["general", "relationship", "academic", "career"] as const) {
      expect(luck[key]).toBeGreaterThanOrEqual(1);
      expect(luck[key]).toBeLessThanOrEqual(5);
      expect(Number.isInteger(luck[key])).toBe(true);
    }
  });

  test("uses the requested local calendar day for 流日", () => {
    const luck = computeDailyLuck(felix, new Date("2026-05-24T15:00:00.000Z"), "-07:00");
    expect(luck.flow.calendar).toEqual({ year: 2026, month: 5, day: 24 });
    expect(luck.flow.day_pillar.gan_zhi).toBe(
      computeFlowPillars(2026, 5, 24).day_pillar.gan_zhi,
    );
  });
});

describe("rawToLuckScore", () => {
  test("maps bounds to 1 and 5", () => {
    expect(rawToLuckScore(-3)).toBe(1);
    expect(rawToLuckScore(5)).toBe(5);
  });
});
