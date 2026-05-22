// src/card/template.tsx
import React from "react";

export interface ProfileCardProps {
  name: string;
  luckyNumber: number;
  luckyColor: string;
  luckyColorHex: string;
  luckyStone: string;
  reading: string;
  lang: "en" | "zh";
}

export interface DailyReadingCardProps {
  question: string;
  date: string;
  avoid: string;
  luck: string;
  relationship: number;
  academic: number;
  career: number;
  general: number;
  name: string;
  lang: "en" | "zh";
}

export interface CardProps {
  question: string;
  hexagramNameZh: string;
  hexagramNameEn: string;
  hexagramNum: number;
  kernelBlock: string;
  interpretationExcerpt: string;
  timestamp: string;
  mode: "cast" | "outcome";
  lang: "en" | "zh";
  lines?: number[];
  palaceName?: string;
  changingLine?: number;
}

// Summer dopamine palette
const BG = "#FFF8F0";
const INK = "#1A0533";
const PINK = "#FF6B9D";
const CORAL = "#FF7B54";
const AQUA = "#4DD9C0";
const SUNNY = "#FFD93D";
const LAVENDER = "#C77DFF";
const SOFT_PINK = "#FFE8F2";
const SOFT_YELLOW = "#FFF8D6";
const SOFT_AQUA = "#E0FAF6";

function ScoreDots({ score, color = PINK, max = 5 }: { score: number; color?: string; max?: number }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{
          width: 28, height: 28, borderRadius: "50%",
          background: i < score ? color : "#F0E8F5",
        }} />
      ))}
    </div>
  );
}

function HexagramLines({ lines, changingLine }: { lines: number[]; changingLine?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
      {[...lines].reverse().map((yang, i) => {
        const lineNum = lines.length - i;
        const isChanging = changingLine === lineNum;
        return (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {yang === 1 ? (
              <div style={{
                width: 200, height: 16, background: isChanging ? CORAL : PINK, borderRadius: 8,
              }} />
            ) : (
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ width: 88, height: 16, background: isChanging ? CORAL : PINK, borderRadius: 8 }} />
                <div style={{ width: 88, height: 16, background: isChanging ? CORAL : PINK, borderRadius: 8 }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProfileCardTemplate(props: ProfileCardProps) {
  const { name, luckyNumber, luckyColor, luckyColorHex, luckyStone, reading, lang } = props;
  const preparedFor = lang === "zh" ? `为 ${name} 准备` : `Prepared for ${name}`;
  const readingExcerpt = reading.length > 220 ? reading.slice(0, 217) + "…" : reading;

  return (
    <div style={{
      width: 1080, height: 1350,
      background: BG,
      fontFamily: '"Noto Sans SC", Inter, sans-serif',
      display: "flex", flexDirection: "column",
      boxSizing: "border-box",
      color: INK,
    }}>
      {/* Hot pink top bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: PINK, padding: "36px 72px",
      }}>
        <span style={{ fontSize: 32, fontWeight: 400, letterSpacing: 6, color: "#fff" }}>运</span>
        <span style={{ fontSize: 20, color: "#fff", opacity: 0.9, letterSpacing: 1 }}>
          {lang === "zh" ? "个人卦盘" : "your profile"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "56px 72px", flex: 1 }}>
        {/* Name */}
        <div style={{ display: "flex", marginBottom: 48 }}>
          <span style={{ fontSize: 68, fontWeight: 400, color: INK, lineHeight: 1.1 }}>{name}</span>
        </div>

        {/* Lucky attributes row */}
        <div style={{ display: "flex", gap: 24, marginBottom: 52 }}>
          {/* Lucky Number */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", flex: 1,
            background: SOFT_YELLOW, borderRadius: 20, padding: "28px 16px",
          }}>
            <div style={{ display: "flex", fontSize: 80, fontWeight: 400, color: CORAL, lineHeight: 1 }}>
              <span>{luckyNumber}</span>
            </div>
            <div style={{ display: "flex", fontSize: 17, color: INK, opacity: 0.5, marginTop: 10 }}>
              <span>{lang === "zh" ? "幸运数字" : "Lucky Number"}</span>
            </div>
          </div>

          {/* Lucky Color */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", flex: 1,
            background: SOFT_PINK, borderRadius: 20, padding: "28px 16px",
          }}>
            <div style={{
              display: "flex",
              width: 80, height: 80, borderRadius: "50%",
              background: luckyColorHex,
            }} />
            <div style={{ display: "flex", fontSize: 20, color: INK, marginTop: 10, fontWeight: 400 }}>
              <span>{luckyColor}</span>
            </div>
            <div style={{ display: "flex", fontSize: 17, color: INK, opacity: 0.5, marginTop: 4 }}>
              <span>{lang === "zh" ? "幸运颜色" : "Lucky Color"}</span>
            </div>
          </div>

          {/* Lucky Stone */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", flex: 1,
            background: SOFT_AQUA, borderRadius: 20, padding: "28px 16px",
          }}>
            <div style={{ display: "flex", fontSize: 52, lineHeight: 1 }}>
              <span>&#10024;</span>
            </div>
            <div style={{ display: "flex", fontSize: 20, color: INK, marginTop: 10, fontWeight: 400 }}>
              <span>{luckyStone}</span>
            </div>
            <div style={{ display: "flex", fontSize: 17, color: INK, opacity: 0.5, marginTop: 4 }}>
              <span>{lang === "zh" ? "幸运宝石" : "Lucky Stone"}</span>
            </div>
          </div>
        </div>

        {/* Broad reading */}
        <div style={{
          display: "flex", flex: 1,
          fontSize: 26, lineHeight: 1.75, color: INK, opacity: 0.85,
          marginBottom: 48,
        }}>
          <span>{readingExcerpt}</span>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          opacity: 0.35, fontSize: 16,
        }}>
          <span>{preparedFor}</span>
          <span>yun.app</span>
        </div>
      </div>
    </div>
  );
}

const SCORE_COLORS: Record<string, string> = {
  relationship: PINK,
  academic: AQUA,
  career: CORAL,
  general: LAVENDER,
};

export function DailyReadingCardTemplate(props: DailyReadingCardProps) {
  const { question, date, avoid, luck, relationship, academic, career, general, name, lang } = props;
  const preparedFor = lang === "zh" ? `为 ${name} 准备` : `Prepared for ${name}`;
  const q = question.length > 80 ? question.slice(0, 77) + "…" : question;

  const labels = lang === "zh"
    ? { relationship: "感情", academic: "学业", career: "事业", general: "综合" }
    : { relationship: "Relationship", academic: "Academic", career: "Career", general: "General" };

  const scores = { relationship, academic, career, general };

  return (
    <div style={{
      width: 1080, height: 1350,
      background: BG,
      fontFamily: '"Noto Sans SC", Inter, sans-serif',
      display: "flex", flexDirection: "column",
      boxSizing: "border-box",
      color: INK,
    }}>
      {/* Coral top bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: CORAL, padding: "36px 72px",
      }}>
        <span style={{ fontSize: 32, fontWeight: 400, letterSpacing: 6, color: "#fff" }}>运</span>
        <span style={{ fontSize: 20, color: "#fff", opacity: 0.9 }}>{date}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "48px 72px", flex: 1 }}>
        {/* Question */}
        <div style={{ display: "flex", marginBottom: 40, maxWidth: 900 }}>
          <span style={{
            fontSize: 26, color: INK, opacity: 0.55,
            fontStyle: "italic", lineHeight: 1.5,
          }}>
            {`"${q}"`}
          </span>
        </div>

        {/* Avoid */}
        <div style={{
          display: "flex", flexDirection: "column",
          background: SOFT_PINK, borderRadius: 16, padding: "24px 28px", marginBottom: 20,
          borderLeft: `6px solid ${PINK}`,
        }}>
          <div style={{ display: "flex", fontSize: 16, color: PINK, marginBottom: 6, fontWeight: 400 }}>
            <span>{lang === "zh" ? "今日要避免" : "try to avoid"}</span>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: INK }}>
            <span>{avoid}</span>
          </div>
        </div>

        {/* Luck */}
        <div style={{
          display: "flex", flexDirection: "column",
          background: SOFT_YELLOW, borderRadius: 16, padding: "24px 28px", marginBottom: 44,
          borderLeft: `6px solid ${SUNNY}`,
        }}>
          <div style={{ display: "flex", fontSize: 16, color: CORAL, marginBottom: 6, fontWeight: 400 }}>
            <span>{lang === "zh" ? "今日运势" : "your luck today"}</span>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: INK }}>
            <span>{luck}</span>
          </div>
        </div>

        {/* Score rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28, flex: 1, marginBottom: 44 }}>
          {(["relationship", "academic", "career", "general"] as const).map((key) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex" }}>
                <span style={{ fontSize: 22, color: INK, opacity: 0.7 }}>{labels[key]}</span>
              </div>
              <ScoreDots score={scores[key]} color={SCORE_COLORS[key] ?? PINK} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          opacity: 0.35, fontSize: 16,
        }}>
          <span>{preparedFor}</span>
          <span>yun.app</span>
        </div>
      </div>
    </div>
  );
}

// Legacy cast/outcome card — kept for share and outcome flows
export function CardTemplate(props: CardProps) {
  const {
    question, hexagramNameZh, hexagramNameEn, hexagramNum,
    kernelBlock, interpretationExcerpt, timestamp,
    mode, lines, palaceName, changingLine,
  } = props;

  const excerpt = interpretationExcerpt.length > 160
    ? interpretationExcerpt.slice(0, 157) + "…"
    : interpretationExcerpt;
  const q = question.length > 80 ? question.slice(0, 77) + "…" : question;

  return (
    <div style={{
      width: 1080, height: 1350,
      background: BG,
      fontFamily: '"Noto Sans SC", Inter, sans-serif',
      display: "flex", flexDirection: "column",
      boxSizing: "border-box",
      color: INK,
    }}>
      {/* Lavender top bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: LAVENDER, padding: "36px 72px",
      }}>
        <span style={{ fontSize: 32, fontWeight: 400, letterSpacing: 6, color: "#fff" }}>运</span>
        {mode === "outcome"
          ? <span style={{ fontSize: 20, color: "#fff", opacity: 0.9 }}>called it ✓</span>
          : <span />
        }
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "48px 72px", flex: 1 }}>
        {/* Question */}
        <div style={{ display: "flex", marginBottom: 44, maxWidth: 900 }}>
          <span style={{ fontSize: 28, color: INK, opacity: 0.6, fontStyle: "italic", lineHeight: 1.4 }}>
            {`"${q}"`}
          </span>
        </div>

        {/* Hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 44 }}>
          {palaceName ? (
            <div style={{ display: "flex", fontSize: 140, lineHeight: 1, marginBottom: 28, color: PINK }}>
              <span>{palaceName}</span>
            </div>
          ) : lines ? (
            <div style={{ display: "flex", marginBottom: 28 }}>
              <HexagramLines lines={lines} changingLine={changingLine} />
            </div>
          ) : <div style={{ display: "flex" }} />}

          <div style={{ display: "flex", fontSize: 72, fontWeight: 400, marginBottom: 8 }}>
            <span>{hexagramNameZh}</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: CORAL, letterSpacing: 2, marginBottom: 4 }}>
            <span>{hexagramNameEn} · {hexagramNum}</span>
          </div>
          {changingLine
            ? <div style={{ display: "flex", fontSize: 18, color: INK, opacity: 0.5, marginTop: 4 }}>
                <span>line {changingLine} changing</span>
              </div>
            : <div style={{ display: "flex" }} />
          }
        </div>

        {/* Kernel block */}
        <div style={{
          display: "flex",
          background: SOFT_AQUA, borderRadius: 12, padding: "20px 24px", marginBottom: 32,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 17, lineHeight: 1.6, color: INK, opacity: 0.75,
          whiteSpace: "pre-wrap",
        }}>
          <span>{kernelBlock}</span>
        </div>

        {/* Interpretation */}
        <div style={{ display: "flex", flex: 1, fontSize: 24, lineHeight: 1.65, color: INK, opacity: 0.85, marginBottom: 36 }}>
          <span>{excerpt}</span>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          opacity: 0.35, fontSize: 16,
        }}>
          <span>{timestamp}</span>
          <span>yun.app</span>
        </div>
      </div>
    </div>
  );
}
