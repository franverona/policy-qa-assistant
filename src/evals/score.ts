import type { EvalRecord } from './run'

// Column names match the "Eval scores log" table in DECISIONS.md. null = not scored yet.
export type Scores = {
  hitAt5: number | null
  mrr: number | null
  answerAccuracy: number | null
  idkPrecision: number | null
  idkRecall: number | null
}

// TODO(m4-scoring, Fran). Suggested definitions; a retrieved chunk matches a source when
// documentId === source.doc and headingPath ends with ' › ' + source.clause.
// - hitAt5: share of answerable questions with a matching chunk in retrieved[0..TOP)
// - mrr: mean over answerable questions of 1 / rank of the first matching chunk (0 if none)
// - answerAccuracy: share of answerable questions answered (not IDK) whose answer contains
//   every fact, ignoring case
// - idkPrecision: of the IDK results, the share that were unanswerable questions
// - idkRecall: of the unanswerable questions, the share that got an IDK
// An errored record (result null) counts as a miss everywhere.
export function score(_records: EvalRecord[]): Scores {
  return { hitAt5: null, mrr: null, answerAccuracy: null, idkPrecision: null, idkRecall: null }
}
