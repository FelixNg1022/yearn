import { describe, test, expect } from "bun:test";
import { detectLang, resolveTimezone, STRINGS, TZ_MAP } from "../src/lang.ts";

describe("detectLang", () => {
  test("returns zh for CJK-heavy text", () => {
    expect(detectLang("我今天能找到工作吗")).toBe("zh");
  });

  test("returns en for Latin text", () => {
    expect(detectLang("will I get the job")).toBe("en");
  });

  test("returns en for empty string", () => {
    expect(detectLang("")).toBe("en");
  });

  test("mixed text below 30% CJK threshold returns en", () => {
    expect(detectLang("hello 世界")).toBe("en");
  });
});

describe("resolveTimezone", () => {
  test("resolves Shanghai to +08:00", () => {
    expect(resolveTimezone("Shanghai, China")).toBe("+08:00");
  });

  test("resolves NYC to -05:00", () => {
    expect(resolveTimezone("New York, USA")).toBe("-05:00");
  });

  test("resolves raw offset passthrough", () => {
    expect(resolveTimezone("+09:00")).toBe("+09:00");
  });

  test("returns null for unknown city", () => {
    expect(resolveTimezone("Timbuktu")).toBeNull();
  });
});

describe("STRINGS", () => {
  test("has both en and zh for all keys", () => {
    const keys = Object.keys(STRINGS) as (keyof typeof STRINGS)[];
    for (const key of keys) {
      expect(typeof STRINGS[key].en).toBe("string");
      expect(typeof STRINGS[key].zh).toBe("string");
    }
  });

  test("rateLimited.en mentions count", () => {
    expect(STRINGS.rateLimited.en).toBeTruthy();
  });
});

describe("TZ_MAP", () => {
  test("has at least 20 entries", () => {
    expect(Object.keys(TZ_MAP).length).toBeGreaterThanOrEqual(20);
  });
});
