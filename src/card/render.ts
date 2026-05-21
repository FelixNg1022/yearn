// src/card/render.ts
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import React from "react";
import { CardTemplate, ProfileCardTemplate, DailyReadingCardTemplate, type CardProps, type ProfileCardProps, type DailyReadingCardProps } from "./template.tsx";
import { loadFonts } from "./fonts.ts";

export interface RenderInput {
  question: string;
  cast: unknown;
  interpretation: string;
  lang: "en" | "zh";
  timestamp: Date;
  mode: "cast" | "outcome";
}

function extractCardProps(input: RenderInput): CardProps {
  const { question, cast, interpretation, lang, timestamp, mode } = input;
  const c = cast as Record<string, unknown>;
  const ts = timestamp.toISOString().slice(0, 16).replace("T", " ");
  const excerpt = interpretation.split(/[.。!！]/)[0] ?? interpretation;

  if (c.method === "liuren") {
    const month = (c.month_palace as { name: string }).name;
    const day = (c.day_palace as { name: string }).name;
    const hour = (c.hour_palace as { name: string }).name;
    return {
      question, lang, mode,
      hexagramNameZh: `${month}/${day}/${hour}`,
      hexagramNameEn: "小六壬",
      hexagramNum: 0,
      kernelBlock: [`月 → ${month}`, `日 → ${day}`, `时 → ${hour}`].join("\n"),
      interpretationExcerpt: excerpt,
      timestamp: ts,
      palaceName: month,
    };
  }

  // meihua
  const primary = c.primary as { name_zh: string; name_en: string; num: number; binary?: number[] };
  const changed = c.changed as { name_zh: string; name_en: string; num: number };
  const math = c.math as Record<string, number | string>;
  const lunar = c.lunar as Record<string, string | number>;

  const kernelBlock = [
    `lunar: ${lunar.year_gz}年 月${lunar.month} 日${lunar.day} ${lunar.hour_zhi}时`,
    `upper: (${math.year_zhi_num}+${math.lunar_month}+${math.lunar_day}) mod 8 = ${math.upper_mod} → ${math.upper_trigram}`,
    `lower: (+${math.hour_zhi_num}) mod 8 = ${math.lower_mod} → ${math.lower_trigram}`,
    `→ ${primary.name_zh} → ${changed.name_zh}`,
  ].join("\n");

  return {
    question, lang, mode,
    hexagramNameZh: primary.name_zh,
    hexagramNameEn: primary.name_en,
    hexagramNum: primary.num,
    kernelBlock,
    interpretationExcerpt: excerpt,
    timestamp: ts,
    lines: primary.binary,
    changingLine: math.changing_line as number,
  };
}

async function satoriToPng(element: React.ReactElement, width: number, height: number): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(element, {
    width,
    height,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

export async function renderCastCard(input: RenderInput): Promise<Buffer> {
  const props = extractCardProps(input);
  return satoriToPng(React.createElement(CardTemplate, props), 1080, 1350);
}

export interface ProfileRenderInput {
  name: string;
  luckyNumber: number;
  luckyColor: string;
  luckyColorHex: string;
  luckyStone: string;
  reading: string;
  lang: "en" | "zh";
}

export async function renderProfileCard(input: ProfileRenderInput): Promise<Buffer> {
  const props: ProfileCardProps = {
    name: input.name,
    luckyNumber: input.luckyNumber,
    luckyColor: input.luckyColor,
    luckyColorHex: input.luckyColorHex,
    luckyStone: input.luckyStone,
    reading: input.reading,
    lang: input.lang,
  };
  return satoriToPng(React.createElement(ProfileCardTemplate, props), 1080, 1350);
}

export interface DailyRenderInput {
  question: string;
  date: Date;
  avoid: string;
  luck: string;
  relationship: number;
  academic: number;
  career: number;
  general: number;
  name: string;
  lang: "en" | "zh";
}

export async function renderDailyReadingCard(input: DailyRenderInput): Promise<Buffer> {
  const dateStr = input.date.toLocaleDateString(input.lang === "zh" ? "zh-CN" : "en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const props: DailyReadingCardProps = {
    question: input.question,
    date: dateStr,
    avoid: input.avoid,
    luck: input.luck,
    relationship: input.relationship,
    academic: input.academic,
    career: input.career,
    general: input.general,
    name: input.name,
    lang: input.lang,
  };
  return satoriToPng(React.createElement(DailyReadingCardTemplate, props), 1080, 1350);
}
