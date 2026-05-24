import { describe, test, expect } from "bun:test";
import {
  deriveCoreLuckyAttributes,
  deriveProfileStatsFallback,
  hashBazi,
} from "../src/card/luckyAttributes.ts";
import { VALID_STONES } from "../src/card/stones.ts";
import fs from "node:fs";
import path from "node:path";

describe("deriveCoreLuckyAttributes", () => {
  const sampleBazi = {
    year: { stem: "甲", branch: "子" },
    month: { stem: "丙", branch: "寅" },
    day: { stem: "癸", branch: "亥" },
    hour: { stem: "庚", branch: "申" },
  };

  test("is stable for the same 八字", () => {
    const a = deriveCoreLuckyAttributes(sampleBazi);
    const b = deriveCoreLuckyAttributes(sampleBazi);
    expect(a).toEqual(b);
  });

  test("returns only valid stones and colors", () => {
    const attrs = deriveCoreLuckyAttributes(sampleBazi);
    expect(VALID_STONES).toContain(attrs.stone);
    expect(attrs.number).toBeGreaterThanOrEqual(1);
    expect(attrs.number).toBeLessThanOrEqual(9);
  });

  test("changes when 八字 changes", () => {
    const other = { ...sampleBazi, day: { stem: "甲", branch: "子" } };
    expect(hashBazi(sampleBazi)).not.toBe(hashBazi(other));
  });
});

describe("deriveProfileStatsFallback", () => {
  test("differs for different 八字", () => {
    const a = { day: { stem: "癸", branch: "亥" } };
    const b = { day: { stem: "甲", branch: "子" } };
    const statsA = deriveProfileStatsFallback(a);
    const statsB = deriveProfileStatsFallback(b);
    expect(statsA.millionaireChance).not.toBe(statsB.millionaireChance);
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
