import { describe, test, expect } from "bun:test";
import { cleanProjection, trimProjection, PROJECTION_LIMIT } from "../src/card/projection.ts";

describe("trimProjection", () => {
  test("strips markdown asterisks", () => {
    expect(cleanProjection("**大海水 meets 钗钏金** energy")).toBe("大海水 meets 钗钏金 energy");
  });

  test("passes through short English copy", () => {
    const text = "a season of bold moves pays off — trust the momentum.";
    expect(trimProjection(text, "en")).toBe(text);
    expect(text.length).toBeLessThanOrEqual(PROJECTION_LIMIT.en);
  });

  test("trims long English at word boundary", () => {
    const long =
      "yo felix — your broad fortune rn is giving 大海水 meets 钗钏金 energy. your 八字 is lowkey stacked: day master 癸水 swimming deep, and the universe said keep going.";
    const trimmed = trimProjection(long, "en");
    expect(trimmed.length).toBeLessThanOrEqual(PROJECTION_LIMIT.en + 1);
    expect(trimmed.endsWith("…")).toBe(true);
  });

  test("trims long Chinese within limit", () => {
    const long = "癸水日主，大海水命，近期运势如深流潜行，事业与感情皆有暗涌，宜静观其变，勿急于求成，守住本心方能见转机。".repeat(2);
    const trimmed = trimProjection(long, "zh");
    expect(trimmed.length).toBeLessThanOrEqual(PROJECTION_LIMIT.zh + 1);
  });
});
