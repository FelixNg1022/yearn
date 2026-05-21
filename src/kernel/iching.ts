import type { Trigram } from './trigrams.ts'
import { flipLine, hexagramBinary } from './trigrams.ts'
import hexagramsData from './data/hexagrams.json' with { type: 'json' }

export interface Hexagram {
  num: number
  name_zh: string
  name_en: string
  binary: string
  trigram_upper: Trigram
  trigram_lower: Trigram
  judgment_zh: string
  judgment_en: string
  image_zh: string
  lines_zh: readonly [string, string, string, string, string, string]
}

// JSON import widens string-literal fields (trigram names) and widens the
// 6-tuple to string[], so we cast via `unknown` and rely on the iching
// integrity tests to guarantee the shape.
const HEXAGRAMS = hexagramsData as unknown as ReadonlyArray<Hexagram>

const BY_BINARY = new Map<string, Hexagram>()
const BY_NUM = new Map<number, Hexagram>()
for (const hex of HEXAGRAMS) {
  BY_BINARY.set(hex.binary, hex)
  BY_NUM.set(hex.num, hex)
}

export function allHexagrams(): ReadonlyArray<Hexagram> {
  return HEXAGRAMS
}

export function hexagramByBinary(binary: string): Hexagram {
  const hex = BY_BINARY.get(binary)
  if (!hex) throw new Error(`Hexagram not found for binary: ${binary}`)
  return hex
}

export function hexagramByNum(num: number): Hexagram {
  const hex = BY_NUM.get(num)
  if (!hex) throw new Error(`Hexagram not found for num: ${num}`)
  return hex
}

export function hexagramByTrigrams(upper: Trigram, lower: Trigram): Hexagram {
  return hexagramByBinary(hexagramBinary(upper, lower))
}

export function changedHexagram(source: Hexagram, changingLine: number): Hexagram {
  return hexagramByBinary(flipLine(source.binary, changingLine))
}
