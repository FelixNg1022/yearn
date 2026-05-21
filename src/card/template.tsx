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

const CREAM = "#F5F0E8";
const INK = "#1A1A1A";
const ACCENT = "#8B6F47";
const MONO_BG = "#EFEFEA";

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
                width: 200, height: 16, background: isChanging ? ACCENT : INK, borderRadius: 2,
              }} />
            ) : (
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ width: 88, height: 16, background: isChanging ? ACCENT : INK, borderRadius: 2 }} />
                <div style={{ width: 88, height: 16, background: isChanging ? ACCENT : INK, borderRadius: 2 }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
      background: CREAM,
      fontFamily: '"Noto Sans SC", Inter, sans-serif',
      display: "flex", flexDirection: "column",
      padding: "60px 72px",
      boxSizing: "border-box",
      color: INK,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
        <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: 4, color: ACCENT }}>运</span>
        {mode === "outcome"
          ? <span style={{ fontSize: 22, color: ACCENT, letterSpacing: 1 }}>called it</span>
          : <span />
        }
      </div>

      {/* Question */}
      <div style={{
        display: "flex", marginBottom: 48, maxWidth: 900,
      }}>
        <span style={{
          fontSize: 28, color: INK, opacity: 0.6,
          fontStyle: "italic", lineHeight: 1.4,
        }}>
          {`"${q}"`}
        </span>
      </div>

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48 }}>
        {palaceName ? (
          <div style={{ display: "flex", fontSize: 140, lineHeight: 1, marginBottom: 32, color: INK }}>
            <span>{palaceName}</span>
          </div>
        ) : lines ? (
          <div style={{ display: "flex", marginBottom: 32 }}>
            <HexagramLines lines={lines} changingLine={changingLine} />
          </div>
        ) : <div style={{ display: "flex" }} />}

        <div style={{ display: "flex", fontSize: 72, fontWeight: 400, marginBottom: 8 }}>
          <span>{hexagramNameZh}</span>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: ACCENT, letterSpacing: 2, marginBottom: 4 }}>
          <span>{hexagramNameEn} · {hexagramNum}</span>
        </div>
        {changingLine
          ? <div style={{ display: "flex", fontSize: 18, color: INK, opacity: 0.5, marginTop: 4 }}>
              <span>line {changingLine} changing</span>
            </div>
          : <div style={{ display: "flex" }} />
        }
      </div>

      {/* Kernel math block */}
      <div style={{
        display: "flex",
        background: MONO_BG, borderRadius: 8, padding: "24px 28px", marginBottom: 36,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 18, lineHeight: 1.6, color: INK, opacity: 0.8,
        whiteSpace: "pre-wrap",
      }}>
        <span>{kernelBlock}</span>
      </div>

      {/* Interpretation excerpt */}
      <div style={{
        display: "flex", fontSize: 24, lineHeight: 1.6, color: INK, opacity: 0.85,
        marginBottom: 40,
      }}>
        <span>{excerpt}</span>
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        opacity: 0.4, fontSize: 16,
      }}>
        <span>{timestamp}</span>
        <span>yun.app</span>
      </div>
    </div>
  );
}

function Stars({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{
          width: 24, height: 24, borderRadius: "50%",
          background: i < score ? ACCENT : MONO_BG,
        }} />
      ))}
    </div>
  );
}

export function ProfileCardTemplate(props: ProfileCardProps) {
  const { name, luckyNumber, luckyColor, luckyColorHex, luckyStone, reading, lang } = props;
  const preparedFor = lang === "zh" ? `为 ${name} 准备` : `Prepared for ${name}`;
  const readingExcerpt = reading.length > 200 ? reading.slice(0, 197) + "…" : reading;

  return (
    <div style={{
      width: 1080, height: 1350,
      background: CREAM,
      fontFamily: '"Noto Sans SC", Inter, sans-serif',
      display: "flex", flexDirection: "column",
      padding: "60px 72px",
      boxSizing: "border-box",
      color: INK,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 64 }}>
        <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: 4, color: ACCENT }}>运</span>
        <span style={{ fontSize: 20, color: ACCENT, letterSpacing: 1 }}>
          {lang === "zh" ? "个人卦盘" : "Profile"}
        </span>
      </div>

      {/* Name */}
      <div style={{ display: "flex", marginBottom: 48 }}>
        <span style={{ fontSize: 64, fontWeight: 400, color: INK, lineHeight: 1.2 }}>{name}</span>
      </div>

      {/* Lucky attributes row */}
      <div style={{
        display: "flex", gap: 32, marginBottom: 56,
        background: MONO_BG, borderRadius: 12, padding: "32px 36px",
      }}>
        {/* Lucky Number */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 400, color: ACCENT, lineHeight: 1 }}>
            <span>{luckyNumber}</span>
          </div>
          <div style={{ display: "flex", fontSize: 18, color: INK, opacity: 0.5, marginTop: 8 }}>
            <span>{lang === "zh" ? "幸运数字" : "Lucky Number"}</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: INK, opacity: 0.1 }} />

        {/* Lucky Color */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <div style={{
            display: "flex",
            width: 72, height: 72, borderRadius: "50%",
            background: luckyColorHex,
          }} />
          <div style={{ display: "flex", fontSize: 20, color: INK, marginTop: 8 }}>
            <span>{luckyColor}</span>
          </div>
          <div style={{ display: "flex", fontSize: 18, color: INK, opacity: 0.5, marginTop: 4 }}>
            <span>{lang === "zh" ? "幸运颜色" : "Lucky Color"}</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: INK, opacity: 0.1 }} />

        {/* Lucky Stone */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 48, lineHeight: 1 }}>
            <span>💎</span>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: INK, marginTop: 8 }}>
            <span>{luckyStone}</span>
          </div>
          <div style={{ display: "flex", fontSize: 18, color: INK, opacity: 0.5, marginTop: 4 }}>
            <span>{lang === "zh" ? "幸运宝石" : "Lucky Stone"}</span>
          </div>
        </div>
      </div>

      {/* Broad reading */}
      <div style={{
        display: "flex", flex: 1,
        fontSize: 26, lineHeight: 1.7, color: INK, opacity: 0.85,
        marginBottom: 48,
      }}>
        <span>{readingExcerpt}</span>
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        opacity: 0.4, fontSize: 16,
      }}>
        <span>{preparedFor}</span>
        <span>yun.app</span>
      </div>
    </div>
  );
}

export function DailyReadingCardTemplate(props: DailyReadingCardProps) {
  const { question, date, avoid, luck, relationship, academic, career, general, name, lang } = props;
  const preparedFor = lang === "zh" ? `为 ${name} 准备` : `Prepared for ${name}`;
  const q = question.length > 80 ? question.slice(0, 77) + "…" : question;

  const scoreLabel = (key: string): string => {
    if (lang === "zh") {
      const map: Record<string, string> = {
        relationship: "感情", academic: "学业", career: "事业", general: "综合",
      };
      return map[key] ?? key;
    }
    const map: Record<string, string> = {
      relationship: "Relationship", academic: "Academic", career: "Career", general: "General",
    };
    return map[key] ?? key;
  };

  return (
    <div style={{
      width: 1080, height: 1350,
      background: CREAM,
      fontFamily: '"Noto Sans SC", Inter, sans-serif',
      display: "flex", flexDirection: "column",
      padding: "60px 72px",
      boxSizing: "border-box",
      color: INK,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
        <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: 4, color: ACCENT }}>运</span>
        <span style={{ fontSize: 20, color: ACCENT, letterSpacing: 1 }}>{date}</span>
      </div>

      {/* Question */}
      <div style={{ display: "flex", marginBottom: 48, maxWidth: 900 }}>
        <span style={{
          fontSize: 28, color: INK, opacity: 0.6,
          fontStyle: "italic", lineHeight: 1.4,
        }}>
          {`"${q}"`}
        </span>
      </div>

      {/* Avoid */}
      <div style={{
        display: "flex", flexDirection: "column",
        background: MONO_BG, borderRadius: 12, padding: "28px 32px", marginBottom: 28,
      }}>
        <div style={{ display: "flex", fontSize: 18, color: INK, opacity: 0.5, marginBottom: 8 }}>
          <span>{lang === "zh" ? "今日要避免" : "Try to avoid:"}</span>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: INK }}>
          <span>{avoid}</span>
        </div>
      </div>

      {/* Luck */}
      <div style={{
        display: "flex", flexDirection: "column",
        background: MONO_BG, borderRadius: 12, padding: "28px 32px", marginBottom: 48,
      }}>
        <div style={{ display: "flex", fontSize: 18, color: INK, opacity: 0.5, marginBottom: 8 }}>
          <span>{lang === "zh" ? "今日运势" : "Your luck today:"}</span>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: INK }}>
          <span>{luck}</span>
        </div>
      </div>

      {/* Score rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, marginBottom: 48 }}>
        {(["relationship", "academic", "career", "general"] as const).map((key) => {
          const scoreMap = { relationship, academic, career, general };
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex" }}>
                <span style={{ fontSize: 24, color: INK, opacity: 0.7 }}>{scoreLabel(key)}</span>
              </div>
              <Stars score={scoreMap[key]} />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        opacity: 0.4, fontSize: 16,
      }}>
        <span>{preparedFor}</span>
        <span>yun.app</span>
      </div>
    </div>
  );
}
