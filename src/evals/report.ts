import type { EvalRecord } from './run'
import type { Scores } from './score'

export type ReportMeta = {
  date: string
  commit: string
  provider: string
  models: { chat: string; embed: string; rerank: string }
  knobs: { candidates: number; fused: number; top: number; idkThreshold: number }
  questions: number
  durationMs: number
}

export type Report = { meta: ReportMeta; scores: Scores; records: EvalRecord[] }

const GATES = ['low_retrieval_score', 'model_declined', 'no_valid_citations'] as const

const cell = (s: string) => s.replace(/\s+/g, ' ').replace(/\|/g, '\\|')
const num = (n: number | null) => (n === null ? '—' : n.toFixed(3))

// Display aid only: score.ts is the source of truth for hit@5.
function topHit({ question: q, retrieved }: EvalRecord, top: number) {
  if (!q.answerable) return ''
  const hit = retrieved
    .slice(0, top)
    .some((h) =>
      q.sources.some((s) => h.documentId === s.doc && h.headingPath.endsWith(` › ${s.clause}`)),
    )
  return hit ? '✓' : '✗'
}

function outcome({ result, error }: EvalRecord) {
  if (!result) return `**error:** ${error}`
  return result.answerable ? result.answer.slice(0, 120) : `IDK (${result.reason})`
}

export function toMarkdown({ meta, scores: s, records }: Report): string {
  const idks = (gate: string) =>
    records.filter((r) => r.result && !r.result.answerable && r.result.reason === gate).length
  const { models: m, knobs: k } = meta
  return [
    `# Eval report ${meta.date}`,
    '',
    `- Commit: \`${meta.commit}\` · provider \`${meta.provider}\``,
    `- Models: chat \`${m.chat}\` · embed \`${m.embed}\` · rerank \`${m.rerank}\``,
    `- Knobs: candidates ${k.candidates} · fused ${k.fused} · top ${k.top} · IDK threshold ${k.idkThreshold}`,
    `- ${meta.questions} questions in ${Math.round(meta.durationMs / 1000)} s · ${records.filter((r) => r.error).length} errors`,
    '',
    '| hit@5 | MRR | Answer accuracy | IDK precision | IDK recall |',
    '| ----- | --- | --------------- | ------------- | ---------- |',
    `| ${[s.hitAt5, s.mrr, s.answerAccuracy, s.idkPrecision, s.idkRecall].map(num).join(' | ')} |`,
    '',
    '## IDKs per gate',
    '',
    ...GATES.map((g) => `- \`${g}\`: ${idks(g)}`),
    '',
    '## Questions',
    '',
    `| id | category | top-${k.top} hit | result | ms |`,
    '| -- | -------- | --------- | ------ | -- |',
    ...records.map(
      (r) =>
        `| ${r.question.id} | ${r.question.category} | ${topHit(r, k.top)} | ${cell(outcome(r))} | ${r.ms.search + r.ms.rerank + r.ms.answer} |`,
    ),
    '',
  ].join('\n')
}
