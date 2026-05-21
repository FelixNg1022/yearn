import { describe, expect, test } from 'bun:test'
import {
  allHexagrams,
  changedHexagram,
  hexagramByBinary,
  hexagramByNum,
  hexagramByTrigrams,
} from '../../src/kernel/iching.ts'
import { hexagramBinary } from '../../src/kernel/trigrams.ts'

describe('hexagrams.json integrity', () => {
  const hexagrams = allHexagrams()

  test('exactly 64 hexagrams are present', () => {
    expect(hexagrams).toHaveLength(64)
  })

  test('hexagram numbers are 1..64 with no gaps', () => {
    const nums = hexagrams.map((h) => h.num).sort((a, b) => a - b)
    expect(nums).toEqual(Array.from({ length: 64 }, (_, i) => i + 1))
  })

  test('binaries are unique 6-bit strings covering all 64 values', () => {
    const binaries = new Set(hexagrams.map((h) => h.binary))
    expect(binaries.size).toBe(64)
    for (const b of binaries) {
      expect(/^[01]{6}$/.test(b)).toBe(true)
    }
  })

  test('each binary matches its declared trigram_upper|trigram_lower composition', () => {
    for (const h of hexagrams) {
      expect(hexagramBinary(h.trigram_upper, h.trigram_lower)).toBe(h.binary)
    }
  })

  test('every hexagram has exactly 6 line texts and non-empty canonical fields', () => {
    for (const h of hexagrams) {
      expect(h.lines_zh).toHaveLength(6)
      for (const line of h.lines_zh) {
        expect(typeof line).toBe('string')
        expect(line.length).toBeGreaterThan(0)
      }
      expect(h.name_zh.length).toBeGreaterThan(0)
      expect(h.name_en.length).toBeGreaterThan(0)
      expect(h.judgment_zh.length).toBeGreaterThan(0)
      expect(h.judgment_en.length).toBeGreaterThan(0)
      expect(h.image_zh.length).toBeGreaterThan(0)
    }
  })
})

describe('hexagram lookup', () => {
  test('乾 (#1) = 111111 / 乾+乾', () => {
    const h = hexagramByNum(1)
    expect(h.name_zh).toBe('乾')
    expect(h.binary).toBe('111111')
    expect(h.trigram_upper).toBe('乾')
    expect(h.trigram_lower).toBe('乾')
  })

  test('坤 (#2) = 000000 / 坤+坤', () => {
    const h = hexagramByNum(2)
    expect(h.name_zh).toBe('坤')
    expect(h.binary).toBe('000000')
    expect(h.trigram_upper).toBe('坤')
    expect(h.trigram_lower).toBe('坤')
  })

  test('剝 (#23) = 100000 / 艮+坤', () => {
    const h = hexagramByNum(23)
    expect(h.name_zh).toBe('剝')
    expect(h.binary).toBe('100000')
    expect(h.trigram_upper).toBe('艮')
    expect(h.trigram_lower).toBe('坤')
  })

  test('革 (#49) = 011101 / 兌+離', () => {
    const h = hexagramByNum(49)
    expect(h.name_zh).toBe('革')
    expect(h.binary).toBe('011101')
    expect(h.trigram_upper).toBe('兌')
    expect(h.trigram_lower).toBe('離')
  })

  test('未濟 (#64) = 101010 / 離+坎', () => {
    const h = hexagramByNum(64)
    expect(h.name_zh).toBe('未濟')
    expect(h.binary).toBe('101010')
    expect(h.trigram_upper).toBe('離')
    expect(h.trigram_lower).toBe('坎')
  })

  test('byBinary and byTrigrams agree with byNum', () => {
    const h = hexagramByNum(23)
    expect(hexagramByBinary('100000').num).toBe(23)
    expect(hexagramByTrigrams('艮', '坤').num).toBe(23)
  })

  test('unknown lookups throw', () => {
    expect(() => hexagramByNum(0)).toThrow()
    expect(() => hexagramByNum(65)).toThrow()
    expect(() => hexagramByBinary('bad')).toThrow()
  })
})

describe('changedHexagram', () => {
  test('剝 with line 6 changing → 坤', () => {
    const po = hexagramByNum(23)
    const changed = changedHexagram(po, 6)
    expect(changed.num).toBe(2)
    expect(changed.binary).toBe('000000')
  })

  test('乾 with line 1 changing → 姤 (#44)', () => {
    // flip bottom line of 111111 → 111110 = 乾+巽 = 姤
    const qian = hexagramByNum(1)
    const changed = changedHexagram(qian, 1)
    expect(changed.num).toBe(44)
  })

  test('changed hexagram round-trip: flipping the changing line again returns the primary', () => {
    const h = hexagramByNum(49)
    const flipped = changedHexagram(h, 3)
    const back = changedHexagram(flipped, 3)
    expect(back.num).toBe(h.num)
  })
})
