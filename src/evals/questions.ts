import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

// A source is a doc id plus the clause heading: the last part of a chunk's heading_path,
// for PDFs and wiki pages alike. Pages are not used because they move when the renderer changes.
const Source = z.object({ doc: z.string().min(1), clause: z.string().min(1) })

const Answerable = z.object({
  id: z.string().regex(/^q\d{2}$/),
  question: z.string().min(1),
  answerable: z.literal(true),
  category: z.enum(['lookup', 'paraphrase', 'code', 'edition', 'cross-doc', 'exclusion']),
  sources: z.array(Source).min(1),
  facts: z.array(z.string().min(1)).min(1), // must appear in a correct answer (ignoring case)
  reference: z.string().min(1),
})

const Unanswerable = z.object({
  id: z.string().regex(/^u\d{2}$/),
  question: z.string().min(1),
  answerable: z.literal(false),
  category: z.enum(['pricing', 'not-stated', 'customer-data', 'off-topic']),
  reference: z.string().min(1), // why the corpus can't answer it
})

export const Question = z.discriminatedUnion('answerable', [Answerable, Unanswerable])
export type Question = z.infer<typeof Question>

export const QUESTIONS_FILE = join(process.cwd(), 'evals/questions.json')

export const loadQuestions = (file = QUESTIONS_FILE): Question[] =>
  z.array(Question).parse(JSON.parse(readFileSync(file, 'utf8')))
