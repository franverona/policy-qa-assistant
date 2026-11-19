import { describe, expect, it } from 'vitest'
import { chunk, tokens } from './chunk'

describe('chunk', () => {
  it('makes one chunk per section with text and drops heading-only sections', () => {
    const chunks = chunk([
      { path: ['Doc', 'Part A'], paras: [] },
      { path: ['Doc', 'Part A', 'A.1 Flood'], paras: [{ text: 'Not covered.', page: 1 }] },
      { path: ['Doc', 'Part A', 'A.2 Fire'], paras: [{ text: 'Covered.', page: 2 }] },
      { path: ['Wiki', 'Refunds'], anchor: 'refunds', paras: [{ text: 'One.' }, { text: 'Two.' }] },
    ])
    expect(chunks).toEqual([
      { ordinal: 0, headingPath: 'Doc › Part A › A.1 Flood', page: 1, content: 'Not covered.' },
      { ordinal: 1, headingPath: 'Doc › Part A › A.2 Fire', page: 2, content: 'Covered.' },
      { ordinal: 2, headingPath: 'Wiki › Refunds', anchor: 'refunds', content: 'One.\n\nTwo.' },
    ])
  })

  it('splits a long clause at sentences with overlap, keeping each piece’s page', () => {
    const sentence = (n: number) =>
      `Sentence ${n} of the clause says something about the deductible.`
    const para = (from: number) =>
      Array.from({ length: 30 }, (_, i) => sentence(from + i)).join(' ')
    const chunks = chunk([
      {
        path: ['Doc', 'Long'],
        paras: [
          { text: para(0), page: 3 },
          { text: para(30), page: 4 },
        ],
      },
    ])

    expect(chunks.length).toBeGreaterThan(2)
    for (const c of chunks) expect(tokens(c.content)).toBeLessThanOrEqual(350)
    for (let i = 1; i < chunks.length; i++) {
      const prevLast = chunks[i - 1].content.split(/(?<=\.)\s+/).at(-1)!
      expect(chunks[i].content.startsWith(prevLast)).toBe(true)
    }
    // Nothing lost: every sentence appears somewhere.
    const all = chunks.map((c) => c.content).join(' ')
    for (let n = 0; n < 60; n++) expect(all).toContain(sentence(n))
    expect(chunks[0].page).toBe(3)
    expect(chunks.at(-1)!.page).toBe(4)
  })
})
