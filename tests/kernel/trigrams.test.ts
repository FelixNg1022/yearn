import { describe, expect, test } from 'bun:test'
import {
  flipLine,
  hexagramBinary,
  trigramBits,
  trigramByXianTian,
  xianTianOf,
} from '../../src/kernel/trigrams.ts'

describe('trigram helpers', () => {
  test('先天 order maps 1-8 to 乾兌離震巽坎艮坤', () => {
    expect(trigramByXianTian(1)).toBe('乾')
    expect(trigramByXianTian(2)).toBe('兌')
    expect(trigramByXianTian(3)).toBe('離')
    expect(trigramByXianTian(4)).toBe('震')
    expect(trigramByXianTian(5)).toBe('巽')
    expect(trigramByXianTian(6)).toBe('坎')
    expect(trigramByXianTian(7)).toBe('艮')
    expect(trigramByXianTian(8)).toBe('坤')
  })

  test('xianTianOf is the inverse of trigramByXianTian', () => {
    for (let n = 1; n <= 8; n++) {
      expect(xianTianOf(trigramByXianTian(n))).toBe(n)
    }
  })

  test('trigram bits encode top-MSB, bottom-LSB', () => {
    expect(trigramBits('乾')).toBe(0b111)
    expect(trigramBits('坤')).toBe(0b000)
    expect(trigramBits('震')).toBe(0b001)
    expect(trigramBits('艮')).toBe(0b100)
    expect(trigramBits('坎')).toBe(0b010)
    expect(trigramBits('離')).toBe(0b101)
    expect(trigramBits('兌')).toBe(0b011)
    expect(trigramBits('巽')).toBe(0b110)
  })

  test('out-of-range trigram number throws', () => {
    expect(() => trigramByXianTian(0)).toThrow()
    expect(() => trigramByXianTian(9)).toThrow()
    expect(() => trigramByXianTian(1.5)).toThrow()
  })
})

describe('hexagramBinary', () => {
  test('乾+乾 = 111111 (hex 1)', () => {
    expect(hexagramBinary('乾', '乾')).toBe('111111')
  })

  test('坤+坤 = 000000 (hex 2)', () => {
    expect(hexagramBinary('坤', '坤')).toBe('000000')
  })

  test('艮+坤 = 100000 (hex 23, 剥)', () => {
    expect(hexagramBinary('艮', '坤')).toBe('100000')
  })

  test('坤+震 = 000001 (hex 24, 復)', () => {
    expect(hexagramBinary('坤', '震')).toBe('000001')
  })

  test('兌+離 = 011101 (hex 49, 革)', () => {
    expect(hexagramBinary('兌', '離')).toBe('011101')
  })

  test('離+坎 = 101010 (hex 64, 未濟)', () => {
    expect(hexagramBinary('離', '坎')).toBe('101010')
  })
})

describe('flipLine', () => {
  test('line 1 flips the rightmost bit (bottom line)', () => {
    expect(flipLine('111111', 1)).toBe('111110')
    expect(flipLine('000000', 1)).toBe('000001')
  })

  test('line 6 flips the leftmost bit (top line)', () => {
    expect(flipLine('111111', 6)).toBe('011111')
    expect(flipLine('000000', 6)).toBe('100000')
  })

  test('剥 (100000) with line 6 changing → 坤 (000000)', () => {
    expect(flipLine('100000', 6)).toBe('000000')
  })

  test('flipping the same line twice is identity', () => {
    for (let line = 1; line <= 6; line++) {
      expect(flipLine(flipLine('110100', line), line)).toBe('110100')
    }
  })

  test('rejects invalid binary or line number', () => {
    expect(() => flipLine('11111', 1)).toThrow()
    expect(() => flipLine('111112', 1)).toThrow()
    expect(() => flipLine('111111', 0)).toThrow()
    expect(() => flipLine('111111', 7)).toThrow()
  })
})
