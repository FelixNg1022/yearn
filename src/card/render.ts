// src/card/render.ts — stub; full implementation in Task 15
export interface RenderInput {
  question: string;
  cast: unknown;
  interpretation: string;
  lang: "en" | "zh";
  timestamp: Date;
  mode: "cast" | "outcome";
}

export async function renderCastCard(_input: RenderInput): Promise<Buffer> {
  throw new Error("renderCastCard not yet implemented — stub for Task 12");
}
