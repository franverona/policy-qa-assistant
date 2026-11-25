import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSource } from '../corpus/source'
import { loadQuestions } from './questions'

const dir = join(process.cwd(), 'corpus/sources')
const docs = readdirSync(dir).map((f) => parseSource(readFileSync(join(dir, f), 'utf8'), f))

// doc id → heading text → the text under it (paragraphs and list items until the next heading)
const clauses = new Map(
  docs.map(({ meta, blocks }) => {
    const byHeading = new Map<string, string>()
    let heading: string | undefined
    for (const b of blocks) {
      if (b.kind === 'section' || b.kind === 'clause') byHeading.set((heading = b.text), '')
      else if (b.kind !== 'title' && heading)
        byHeading.set(
          heading,
          `${byHeading.get(heading)} ${b.kind === 'list' ? b.items.join(' ') : b.text}`,
        )
    }
    return [meta.id, byHeading]
  }),
)

describe('eval questions', () => {
  const questions = loadQuestions()

  it('has 45 answerable and 10 unanswerable questions with unique ids', () => {
    expect(questions.filter((q) => q.answerable)).toHaveLength(45)
    expect(questions.filter((q) => !q.answerable)).toHaveLength(10)
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length)
  })

  it.each(questions.flatMap((q) => (q.answerable ? [q] : [])))(
    '$id: sources are real clauses and contain every fact',
    ({ sources, facts }) => {
      const texts = sources.map(({ doc, clause }) => {
        const text = clauses.get(doc)?.get(clause)
        expect(text, `${doc} › ${clause}`).toBeDefined()
        return text!.toLowerCase()
      })
      for (const fact of facts)
        expect(
          texts.some((t) => t.includes(fact.toLowerCase())),
          fact,
        ).toBe(true)
    },
  )

  it('cites every corpus doc at least once', () => {
    const cited = new Set(
      questions.flatMap((q) => (q.answerable ? q.sources.map((s) => s.doc) : [])),
    )
    expect(docs.map((d) => d.meta.id).filter((id) => !cited.has(id))).toEqual([])
  })
})
