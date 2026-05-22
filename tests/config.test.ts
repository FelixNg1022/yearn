import { describe, test, expect, afterEach } from "bun:test";

describe("config", () => {
  const saved = { ...process.env };

  afterEach(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, saved);
  });

  test("throws when required var is missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(() => {
      const { config } = require("../src/config.ts");
      config.openRouterApiKey();
    }).toThrow("OPENROUTER_API_KEY");
  });

  test("followUpDays defaults to 5", () => {
    delete process.env.FOLLOW_UP_DAYS;
    const { config } = require("../src/config.ts");
    expect(config.followUpDays()).toBe(5);
  });

  test("demoFollowUpSeconds returns undefined when unset", () => {
    delete process.env.DEMO_FOLLOW_UP_SECONDS;
    const { config } = require("../src/config.ts");
    expect(config.demoFollowUpSeconds()).toBeUndefined();
  });
});
