export interface ParsedOutcome {
  outcome: "yes" | "no" | "mixed";
  note: string | null;
}

const YES = ["yes", "y", "是", "是的", "对", "对了", "中", "中了", "准", "准了", "played out", "it did"];
const NO = ["no", "n", "否", "不", "不是", "没有", "没中", "didn't", "it didn't", "it did not", "did not"];
const MIXED = ["mixed", "maybe", "sort of", "kind of", "不確定", "不确定", "一半", "一半一半", "模糊", "差不多"];

function matchLongest(lower: string, tokens: string[]): number | null {
  let best: number | null = null;
  for (const tok of tokens) {
    if (!lower.startsWith(tok)) continue;
    const next = lower.charAt(tok.length);
    const clean = next === "" || /[\s.,!?。，！？]/.test(next);
    if (clean && (best === null || tok.length > best)) best = tok.length;
  }
  return best;
}

function remainder(text: string, prefixLen: number): string | null {
  const rest = text.slice(prefixLen).replace(/^[\s.,!?。，！？]+/, "").trim();
  return rest.length > 0 ? rest : null;
}

export function parseOutcome(text: string): ParsedOutcome | null {
  const lower = text.trim().toLowerCase();
  const yesLen = matchLongest(lower, YES);
  if (yesLen !== null) return { outcome: "yes", note: remainder(text.trim(), yesLen) };
  const noLen = matchLongest(lower, NO);
  if (noLen !== null) return { outcome: "no", note: remainder(text.trim(), noLen) };
  const mixLen = matchLongest(lower, MIXED);
  if (mixLen !== null) return { outcome: "mixed", note: remainder(text.trim(), mixLen) };
  return null;
}

export function looksLikeOutcome(text: string): boolean {
  return text.length < 200 && !text.includes("?") && !text.includes("？");
}

export function isShareRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "share" || t === "分享";
}
