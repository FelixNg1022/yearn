import { describe, test, expect } from "bun:test";
import { buildFollowUpText, elapsedDays } from "../src/scheduler.ts";

const DAY = 86_400_000;

describe("buildFollowUpText", () => {
  test("en follow-up message", () => {
    const msg = buildFollowUpText("will I get the job?", "en", 5);
    expect(msg).toContain("5 days ago");
    expect(msg).toContain("will I get the job?");
    expect(msg).toContain("yes / no / mixed");
  });

  test("zh follow-up message", () => {
    const msg = buildFollowUpText("我能找到工作吗", "zh", 5);
    expect(msg).toContain("5 天前");
    expect(msg).toContain("我能找到工作吗");
  });

  test("truncates long questions", () => {
    const long = "a".repeat(100);
    const msg = buildFollowUpText(long, "en", 5);
    expect(msg.length).toBeLessThan(300);
  });
});

describe("elapsedDays", () => {
  test("rounds 4d 6h to 4 days", () => {
    const created = 1_700_000_000_000;
    expect(elapsedDays(created, created + 4 * DAY + 6 * 3_600_000)).toBe(4);
  });

  test("rounds 3d 14h up to 4 days", () => {
    const created = 1_700_000_000_000;
    expect(elapsedDays(created, created + 3 * DAY + 14 * 3_600_000)).toBe(4);
  });

  test("clamps to a minimum of 1 day even when follow-up fires very early", () => {
    const created = 1_700_000_000_000;
    // demo mode case — follow-up fires 30 seconds after the cast.
    expect(elapsedDays(created, created + 30_000)).toBe(1);
  });

  test("never returns negative when clock skew makes now < created_at", () => {
    const created = 1_700_000_000_000;
    expect(elapsedDays(created, created - 5_000)).toBe(1);
  });
});
