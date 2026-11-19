import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSource } from '../corpus/source'
import { parseHtml, parsePdf, type Section } from './parse'

const SRC = 'corpus/sources'
const OUT = 'corpus/rendered'
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

const parse = (id: string, type: string) =>
  type === 'policy'
    ? parsePdf(new Uint8Array(readFileSync(`${OUT}/${id}.pdf`)))
    : parseHtml(readFileSync(`${OUT}/${id}.html`, 'utf8'))

// Round trip: every rendered doc must parse back to the headings and text of its source.
describe.each(readdirSync(SRC).filter((f) => f.endsWith('.md')))('%s', (file) => {
  const { meta, blocks } = parseSource(readFileSync(`${SRC}/${file}`, 'utf8'), file)

  it('recovers headings, anchors and text', async () => {
    const sections: Section[] = await parse(meta.id, meta.type)
    const headings = blocks.flatMap((b) => ('anchor' in b ? [b] : []))
    expect(sections.map((s) => s.path.at(-1))).toEqual(headings.map((h) => h.text))
    if (meta.type === 'wiki')
      expect(sections.map((s) => s.anchor)).toEqual(headings.map((h) => h.anchor))

    const body = blocks.flatMap((b) =>
      b.kind === 'paragraph' ? [b.text] : b.kind === 'list' ? b.items : [],
    )
    expect(norm(sections.flatMap((s) => s.paras.map((p) => p.text)).join(' '))).toBe(
      norm(body.join(' ')),
    )
  })
})

describe('parsePdf', () => {
  it('builds heading paths and records the page each clause starts on', async () => {
    const sections = await parse('drivewell-auto-2024', 'policy')
    const find = (clause: string) => sections.find((s) => s.path[2]?.startsWith(clause))!
    expect(find('A.1').path).toEqual([
      'DriveWell Personal Auto Policy',
      'Part A — Definitions',
      'A.1 "Covered auto"',
    ])
    expect(find('D.1').paras[0].page).toBe(1)
    expect(find('E.1').paras[0].page).toBe(2)
  })
})
