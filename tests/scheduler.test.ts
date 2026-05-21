import { describe, test, expect } from "bun:test";
import { buildFollowUpText } from "../src/scheduler.ts";

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
