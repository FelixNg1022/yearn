import { describe, test, expect } from "bun:test";
import { normalizeStone, VALID_STONES } from "../src/card/stones.ts";

describe("normalizeStone", () => {
  test("accepts all valid stone ids", () => {
    for (const stone of VALID_STONES) {
      expect(normalizeStone(stone)).toBe(stone);
    }
  });

  test("maps legacy gem names to new stones", () => {
    expect(normalizeStone("emerald")).toBe("jade");
    expect(normalizeStone("Ruby")).toBe("red-agate");
    expect(normalizeStone("SAPPHIRE")).toBe("lapis-lazuli");
  });

  test("normalizes spaces to hyphens", () => {
    expect(normalizeStone("Clear Quartz")).toBe("clear-quartz");
    expect(normalizeStone("tiger eye")).toBe("tiger-eye");
  });

  test("falls back to jade for unknown stones", () => {
    expect(normalizeStone("diamond")).toBe("jade");
    expect(normalizeStone("")).toBe("jade");
    expect(normalizeStone(undefined)).toBe("jade");
  });
});
