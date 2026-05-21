import { describe, test, expect } from "bun:test";
import { parseOutcome, looksLikeOutcome } from "../src/outcomes.ts";

describe("parseOutcome", () => {
  test("parses 'yes'", () => {
    expect(parseOutcome("yes")?.outcome).toBe("yes");
  });

  test("parses 'no'", () => {
    expect(parseOutcome("no")?.outcome).toBe("no");
  });

  test("parses 'mixed'", () => {
    expect(parseOutcome("mixed")?.outcome).toBe("mixed");
  });

  test("parses Chinese yes tokens", () => {
    expect(parseOutcome("是的")?.outcome).toBe("yes");
    expect(parseOutcome("准了")?.outcome).toBe("yes");
  });

  test("captures trailing note", () => {
    const r = parseOutcome("yes, it worked!");
    expect(r?.outcome).toBe("yes");
    expect(r?.note).toBe("it worked!");
  });

  test("returns null for unrecognized text", () => {
    expect(parseOutcome("what should I do?")).toBeNull();
  });
});

describe("looksLikeOutcome", () => {
  test("short text without question marks", () => {
    expect(looksLikeOutcome("yes it worked")).toBe(true);
  });

  test("text with question mark is not an outcome", () => {
    expect(looksLikeOutcome("will I get the job?")).toBe(false);
  });
});
