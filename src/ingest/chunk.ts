import type { Section } from './parse'

// Matches the chunks table minus the embedding. `content` has no heading prefix: the tsv
// column adds heading_path itself, and ingest prepends it before embedding.
export type Chunk = {
  ordinal: number
  headingPath: string
  page?: number
  anchor?: string
  content: string
}

// shortcut: ~4 characters per token for English; use the embedding model's tokenizer if
// chunk sizes start to matter in evals.
export const tokens = (s: string) => Math.ceil(s.length / 4)

type Unit = { text: string; page?: number; para: number }

const SENTENCE = /(?<=[.!?])\s+/

// Units from the same paragraph join with a space, different paragraphs with a blank line.
const join = (units: Unit[]) =>
  units.map((u, i) => (i && units[i - 1].para !== u.para ? '\n\n' : i ? ' ' : '') + u.text).join('')

// The previous chunk's trailing sentences, up to `budget` tokens, carried into the next one.
function overlap(units: Unit[], budget: number): Unit[] {
  const last = units.at(-1)!
  const sentences = last.text.split(SENTENCE)
  let i = sentences.length
  while (i > 0 && tokens(sentences.slice(i - 1).join(' ')) <= budget) i--
  return i < sentences.length ? [{ ...last, text: sentences.slice(i).join(' ') }] : []
}

// One chunk per section (clause, or section text before its first clause). A section longer
// than maxTokens splits at paragraphs, then sentences, with ~15% overlap between pieces.
export function chunk(sections: Section[], maxTokens = 350): Chunk[] {
  const out: Chunk[] = []
  for (const section of sections) {
    const units: Unit[] = section.paras.flatMap((p, para) =>
      tokens(p.text) <= maxTokens
        ? [{ ...p, para }]
        : // shortcut: a single sentence over maxTokens stays whole; fine for policy prose.
          p.text.split(SENTENCE).map((text) => ({ text, page: p.page, para })),
    )
    const flush = (cur: Unit[]) =>
      out.push({
        ordinal: out.length,
        headingPath: section.path.join(' › '),
        page: cur[0].page,
        anchor: section.anchor,
        content: join(cur),
      })

    let cur: Unit[] = []
    let fresh = 0 // units in cur that aren't overlap
    for (const u of units) {
      if (fresh && tokens(join([...cur, u])) > maxTokens) {
        flush(cur)
        cur = overlap(cur, maxTokens * 0.15)
        fresh = 0
      }
      if (!fresh && tokens(join([...cur, u])) > maxTokens) cur = [] // overlap doesn't fit
      cur.push(u)
      fresh++
    }
    if (fresh) flush(cur)
  }
  return out
}
