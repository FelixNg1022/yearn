import { describe, test, expect } from "bun:test";
import {
  extractHorizonHeuristic,
  followUpMsFromHorizon,
  MAX_HORIZON_DAYS,
  MIN_HORIZON_DAYS,
} from "../src/horizon.ts";
import { resolveFollowUpSchedule } from "../src/query.ts";

// A fixed Wednesday so weekday math is deterministic.
const WED = new Date("2026-05-20T12:00:00Z");

describe("extractHorizonHeuristic — English", () => {
  test("explicit 'in 3 days'", () => {
    expect(extractHorizonHeuristic("will the result come in 3 days?", "en", WED))
      .toMatchObject({ horizon_days: 3, source: "in_n_days" });
  });

  test("number word 'in five days'", () => {
    expect(extractHorizonHeuristic("will it land in five days?", "en", WED))
      .toMatchObject({ horizon_days: 5, source: "in_n_days" });
  });

  test("'tomorrow' → 1", () => {
    expect(extractHorizonHeuristic("will she call tomorrow?", "en", WED))
      .toMatchObject({ horizon_days: 1, source: "tomorrow" });
  });

  test("'tonight' → 0", () => {
    expect(extractHorizonHeuristic("will I sleep well tonight?", "en", WED))
      .toMatchObject({ horizon_days: 0, source: "tonight" });
  });

  test("'next week' → 7+", () => {
    // Wednesday → start of next week (Mon) is 5 days; +7 = 12
    expect(extractHorizonHeuristic("will I hear back next week?", "en", WED))
      .toMatchObject({ horizon_days: 12, source: "next_week" });
  });

  test("'in 2 weeks' → 14", () => {
    expect(extractHorizonHeuristic("will the offer arrive in 2 weeks?", "en", WED))
      .toMatchObject({ horizon_days: 14, source: "in_n_weeks" });
  });

  test("'in a month' → 30", () => {
    expect(extractHorizonHeuristic("will the project ship in a month?", "en", WED))
      .toMatchObject({ horizon_days: 30, source: "in_n_months" });
  });

  test("'this Friday' from Wednesday → 2", () => {
    expect(extractHorizonHeuristic("will I get news by Friday?", "en", WED))
      .toMatchObject({ horizon_days: 2, source: "weekday" });
  });

  test("'next Friday' from Wednesday → 9", () => {
    expect(extractHorizonHeuristic("will it close next Friday?", "en", WED))
      .toMatchObject({ horizon_days: 9, source: "next_weekday" });
  });

  test("'a couple of days' → 2", () => {
    expect(extractHorizonHeuristic("in a couple of days will I know?", "en", WED))
      .toMatchObject({ horizon_days: 2, source: "in_n_days" });
  });

  test("clamps absurdly long phrasings", () => {
    const result = extractHorizonHeuristic("will it happen in 99 days?", "en", WED);
    expect(result?.horizon_days).toBe(MAX_HORIZON_DAYS);
  });

  test("open-ended question returns null", () => {
    expect(extractHorizonHeuristic("will I get the job?", "en", WED)).toBeNull();
    expect(extractHorizonHeuristic("should I move?", "en", WED)).toBeNull();
    expect(extractHorizonHeuristic("will me and my girlfriend get married?", "en", WED)).toBeNull();
  });

  test("empty string returns null", () => {
    expect(extractHorizonHeuristic("", "en", WED)).toBeNull();
  });
});

describe("extractHorizonHeuristic — Chinese", () => {
  test("'明天' → 1", () => {
    expect(extractHorizonHeuristic("明天她会回我吗", "zh", WED))
      .toMatchObject({ horizon_days: 1, source: "tomorrow" });
  });

  test("'后天' → 2", () => {
    expect(extractHorizonHeuristic("后天面试会顺利吗", "zh", WED))
      .toMatchObject({ horizon_days: 2, source: "in_n_days" });
  });

  test("'今晚' → 0 (tonight)", () => {
    expect(extractHorizonHeuristic("今晚的饭局气氛会好吗", "zh", WED))
      .toMatchObject({ horizon_days: 0, source: "tonight" });
  });

  test("'3天后' → 3", () => {
    expect(extractHorizonHeuristic("3天后会有消息吗", "zh", WED))
      .toMatchObject({ horizon_days: 3, source: "in_n_days" });
  });

  test("'三天内' → 3", () => {
    expect(extractHorizonHeuristic("三天内能成吗", "zh", WED))
      .toMatchObject({ horizon_days: 3, source: "in_n_days" });
  });

  test("'下周' from Wednesday → 12", () => {
    expect(extractHorizonHeuristic("下周会有结果吗", "zh", WED))
      .toMatchObject({ horizon_days: 12, source: "next_week" });
  });

  test("'下周五' from Wednesday → 9", () => {
    expect(extractHorizonHeuristic("下周五会签合同吗", "zh", WED))
      .toMatchObject({ horizon_days: 9, source: "next_weekday" });
  });

  test("'两周后' → 14", () => {
    expect(extractHorizonHeuristic("两周后能不能拿到offer", "zh", WED))
      .toMatchObject({ horizon_days: 14, source: "in_n_weeks" });
  });

  test("'下个月' → 30", () => {
    expect(extractHorizonHeuristic("下个月能涨工资吗", "zh", WED))
      .toMatchObject({ horizon_days: 30, source: "next_month" });
  });

  test("'几天后' → 3 (fuzzy 'a few')", () => {
    expect(extractHorizonHeuristic("几天后会有人联系我吗", "zh", WED))
      .toMatchObject({ horizon_days: 3, source: "in_n_days" });
  });

  test("open Chinese question returns null", () => {
    expect(extractHorizonHeuristic("我能升职吗", "zh", WED)).toBeNull();
  });
});

describe("followUpMsFromHorizon", () => {
  const DAY = 86_400_000;

  test("3-day horizon + 1-day buffer → 4 days (the user's exact example)", () => {
    expect(followUpMsFromHorizon(3, 1)).toBe(4 * DAY);
  });

  test("same-day question (horizon=0) still waits >= MIN_HORIZON_DAYS", () => {
    // 0 + buffer 1 = 1; 1 >= MIN so we get 1 day total.
    expect(followUpMsFromHorizon(0, 1)).toBe(MIN_HORIZON_DAYS * DAY);
  });

  test("clamps to MAX_HORIZON_DAYS", () => {
    expect(followUpMsFromHorizon(60, 5)).toBe(MAX_HORIZON_DAYS * DAY);
  });

  test("zero buffer is allowed", () => {
    expect(followUpMsFromHorizon(5, 0)).toBe(5 * DAY);
  });
});

describe("resolveFollowUpSchedule", () => {
  const NOW = 1_700_000_000_000;
  const DAY = 86_400_000;

  test("no horizon → no follow-up scheduled", () => {
    const result = resolveFollowUpSchedule({ horizonDays: null, bufferDays: 1, now: NOW });
    expect(result.scheduleFollowUp).toBe(false);
    expect(result.followedUp).toBe(1);
    expect(result.followUpAt).toBe(NOW);
  });

  test("horizon present → schedules follow-up after event + buffer", () => {
    const result = resolveFollowUpSchedule({ horizonDays: 3, bufferDays: 1, now: NOW });
    expect(result.scheduleFollowUp).toBe(true);
    expect(result.followedUp).toBe(0);
    expect(result.followUpAt).toBe(NOW + 4 * DAY);
  });

  test("demo mode always schedules follow-up", () => {
    const result = resolveFollowUpSchedule({
      horizonDays: null,
      demoFollowUpMs: 60_000,
      bufferDays: 1,
      now: NOW,
    });
    expect(result.scheduleFollowUp).toBe(true);
    expect(result.followedUp).toBe(0);
    expect(result.followUpAt).toBe(NOW + 60_000);
  });
});
