import { describe, expect, it } from 'vitest'
import { WARNABSTAND_M, abstandM, istFern } from './abstand'

describe('abstandM', () => {
  it('rechnet in ganzen Metern', () => {
    expect(abstandM([500000, 5400000], [500030, 5400040])).toBe(50)
    expect(abstandM([500000, 5400000], [500001, 5400001])).toBe(1)
    expect(abstandM([500000, 5400000], [500000, 5400000])).toBe(0)
  })
})

describe('istFern', () => {
  it('warnt erst über der Grenze', () => {
    expect(WARNABSTAND_M).toBe(100)
    expect(istFern(100)).toBe(false)
    expect(istFern(101)).toBe(true)
  })
})
