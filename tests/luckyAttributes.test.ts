import { describe, test, expect } from "bun:test";
import { deriveLuckyAttributes, hashBazi } from "../src/card/luckyAttributes.ts";
import { VALID_STONES } from "../src/card/stones.ts";
import fs from "node:fs";
import path from "node:path";

describe("deriveLuckyAttributes", () => {
  const sampleBazi = {
    year: { stem: "甲", branch: "子" },
    month: { stem: "丙", branch: "寅" },
    day: { stem: "癸", branch: "亥" },
    hour: { stem: "庚", branch: "申" },
  };

  test("is stable for the same 八字", () => {
    const a = deriveLuckyAttributes(sampleBazi);
    const b = deriveLuckyAttributes(sampleBazi);
    expect(a).toEqual(b);
  });

  test("returns only valid stones and colors", () => {
    const attrs = deriveLuckyAttributes(sampleBazi);
    expect(VALID_STONES).toContain(attrs.stone);
    expect(attrs.number).toBeGreaterThanOrEqual(1);
    expect(attrs.number).toBeLessThanOrEqual(9);
  });

  test("changes when 八字 changes", () => {
    const other = { ...sampleBazi, day: { stem: "甲", branch: "子" } };
    expect(hashBazi(sampleBazi)).not.toBe(hashBazi(other));
  });
});

describe("stone assets", () => {
  test("every VALID_STONES id has a matching SVG file", () => {
    const dir = path.resolve(import.meta.dir, "../src/card/html/assets/stones");
    for (const stone of VALID_STONES) {
      expect(fs.existsSync(path.join(dir, `${stone}.svg`))).toBe(true);
    }
  });
});
