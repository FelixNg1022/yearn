import type { Lang } from "../db.ts";

/** Max chars that fit in the profile card projection box (5 lines @ 16px). */
export const PROJECTION_LIMIT: Record<Lang, number> = {
  en: 115,
  zh: 85,
};

/** Strip markdown and collapse whitespace before length trimming. */
export function cleanProjection(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/[#_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Trim projection copy so it fits the card without mid-word clipping. */
export function trimProjection(text: string, lang: Lang): string {
  const clean = cleanProjection(text);
  const max = PROJECTION_LIMIT[lang];
  if (clean.length <= max) return clean;

  const slice = clean.slice(0, max);

  if (lang === "zh") {
    const lastPunct = Math.max(
      slice.lastIndexOf("。"),
      slice.lastIndexOf("，"),
      slice.lastIndexOf("、"),
      slice.lastIndexOf(" "),
    );
    if (lastPunct > max * 0.5) return slice.slice(0, lastPunct + (slice[lastPunct] === "。" ? 1 : 0));
    return slice + "…";
  }

  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > max * 0.55) return slice.slice(0, lastSpace) + "…";
  return slice + "…";
}
