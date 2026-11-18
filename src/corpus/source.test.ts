import { describe, expect, it } from 'vitest'
import { parseSource, slug, toHtml } from './source'

const doc = `---
id: sample
title: Sample Policy
type: policy
effective: 2024-01-01
---

# Sample Policy

## Section 2 — Exclusions

### 2.1 Flood

We do not cover
surface water.

- one
- two
`

describe('parseSource', () => {
  it('parses frontmatter and blocks', () => {
    const { meta, blocks } = parseSource(doc)
    expect(meta).toEqual({
      id: 'sample',
      title: 'Sample Policy',
      type: 'policy',
      effective: '2024-01-01',
    })
    expect(blocks).toEqual([
      { kind: 'title', text: 'Sample Policy', anchor: 'sample-policy' },
      { kind: 'section', text: 'Section 2 — Exclusions', anchor: 'section-2-exclusions' },
      { kind: 'clause', text: '2.1 Flood', anchor: '2-1-flood' },
      { kind: 'paragraph', text: 'We do not cover surface water.' },
      { kind: 'list', items: ['one', 'two'] },
    ])
  })

  it('rejects bad frontmatter, missing title and duplicate anchors', () => {
    expect(() => parseSource(doc.replace('type: policy', 'type: memo'))).toThrow(/type/)
    expect(() => parseSource(doc.replace('# Sample Policy\n', 'Intro\n'))).toThrow(/# title/)
    expect(() => parseSource(doc + '\n### 2.1 Flood\n')).toThrow(/duplicate/)
  })
})

describe('toHtml', () => {
  it('gives headings ids and escapes text', () => {
    const html = toHtml(parseSource(doc.replace('surface water.', 'water <& "mud">.')))
    expect(html).toContain('<h3 id="2-1-flood">2.1 Flood</h3>')
    expect(html).toContain('<p>We do not cover water &lt;&amp; &quot;mud&quot;&gt;.</p>')
  })
})

it('slug', () => expect(slug('4.2 "You" & your')).toBe('4-2-you-your'))
