// tests/card.test.ts
import { describe, test, expect } from "bun:test";
import { renderCastCard } from "../src/card/render.ts";

const FAKE_CAST = {
  method: "meihua",
  primary: { name_zh: "恆", name_en: "Perseverance", num: 32, binary: [1,0,1,0,1,1] },
  changed: { name_zh: "豫", name_en: "Enthusiasm", num: 16 },
  changing_line: 3,
  math: {
    year_zhi_num: 7, lunar_month: 6, lunar_day: 10, hour_zhi_num: 4,
    upper_mod: 4, lower_mod: 8, changing_sum: 21,
    upper_trigram: "震", lower_trigram: "巽",
  },
  lunar: { year_gz: "甲辰", month: 6, day: 10, hour_zhi: "卯" },
  cast_at_iso: new Date().toISOString(),
};

describe("renderCastCard", () => {
  test("returns a PNG buffer for cast mode", async () => {
    const png = await renderCastCard({
      question: "Will I get the job?",
      cast: FAKE_CAST,
      interpretation: "The 恆 hexagram suggests steady persistence.",
      lang: "en",
      timestamp: new Date(),
      mode: "cast",
    });
    expect(png).toBeInstanceOf(Buffer);
    expect(png.length).toBeGreaterThan(1000);
    // PNG magic bytes: 89 50 4E 47
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4E);
    expect(png[3]).toBe(0x47);
  }, 15000);

  test("returns a PNG buffer for outcome mode", async () => {
    const png = await renderCastCard({
      question: "Will I get the job?",
      cast: FAKE_CAST,
      interpretation: "The 恆 hexagram suggests steady persistence.",
      lang: "en",
      timestamp: new Date(),
      mode: "outcome",
    });
    expect(png).toBeInstanceOf(Buffer);
    expect(png[0]).toBe(0x89);
  }, 15000);
});
