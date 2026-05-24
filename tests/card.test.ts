// tests/card.test.ts
import { describe, test, expect, afterAll } from "bun:test";
import { renderProfileCard, renderDailyReadingCard, closeRenderer } from "../src/card/render.ts";

afterAll(async () => {
  await closeRenderer();
});

describe("renderProfileCard", () => {
  test("returns a PNG buffer", async () => {
    const png = await renderProfileCard({
      name: "Teri Shim",
      luckyNumber: 7,
      luckyColor: "violet",
      luckyStone: "jade",
      millionaireChance: 73,
      meetLoveAge: 27,
      projection: "a season of bold moves pays off — trust the momentum.",
    });
    expect(png).toBeInstanceOf(Buffer);
    expect(png.length).toBeGreaterThan(1000);
    // PNG magic bytes: 89 50 4E 47
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4E);
    expect(png[3]).toBe(0x47);
  }, 20000);
});

describe("renderDailyReadingCard", () => {
  test("returns a PNG buffer", async () => {
    const png = await renderDailyReadingCard({
      name: "Teri Shim",
      date: new Date("2026-05-22"),
      avoid: "starting drama in the group chat",
      general: 4,
      relationship: 3,
      academic: 5,
      career: 2,
    });
    expect(png).toBeInstanceOf(Buffer);
    expect(png.length).toBeGreaterThan(1000);
    expect(png[0]).toBe(0x89);
  }, 20000);
});
