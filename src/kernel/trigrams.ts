export type Trigram = '乾' | '兌' | '離' | '震' | '巽' | '坎' | '艮' | '坤'

const XIAN_TIAN_ORDER: readonly Trigram[] = ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤']

const TRIGRAM_BITS: Readonly<Record<Trigram, number>> = {
  乾: 0b111,
  兌: 0b011,
  離: 0b101,
  震: 0b001,
  巽: 0b110,
  坎: 0b010,
  艮: 0b100,
  坤: 0b000,
}

export function trigramByXianTian(num: number): Trigram {
  if (num < 1 || num > 8 || !Number.isInteger(num)) {
    throw new RangeError(`trigramByXianTian: num must be 1..8, got ${num}`)
  }
  return XIAN_TIAN_ORDER[num - 1]!
}

export function xianTianOf(trigram: Trigram): number {
  const idx = XIAN_TIAN_ORDER.indexOf(trigram)
  if (idx < 0) throw new Error(`Unknown trigram: ${trigram}`)
  return idx + 1
}

export function trigramBits(trigram: Trigram): number {
  return TRIGRAM_BITS[trigram]
}

export function hexagramBinary(upper: Trigram, lower: Trigram): string {
  const value = (trigramBits(upper) << 3) | trigramBits(lower)
  return value.toString(2).padStart(6, '0')
}

export function flipLine(binary: string, line: number): string {
  if (binary.length !== 6 || !/^[01]{6}$/.test(binary)) {
    throw new Error(`flipLine: binary must be 6 chars of 0/1, got "${binary}"`)
  }
  if (line < 1 || line > 6 || !Number.isInteger(line)) {
    throw new RangeError(`flipLine: line must be 1..6, got ${line}`)
  }
  const idx = 6 - line
  const flipped = binary[idx] === '1' ? '0' : '1'
  return binary.slice(0, idx) + flipped + binary.slice(idx + 1)
}

export const TRIGRAMS_XIAN_TIAN: readonly Trigram[] = XIAN_TIAN_ORDER
