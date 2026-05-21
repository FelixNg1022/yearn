// src/card/template.tsx
import React from "react";

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
