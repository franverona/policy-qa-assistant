// Runs every question in evals/questions.json through retrieval + answer and writes
// evals/reports/<date>.json and .md, stamped with the models and knobs. Usage: pnpm eval
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IDK_THRESHOLD } from '../src/answer/answer'
import { getConfig } from '../src/config'
import { getDb } from '../src/db/client'
import { loadQuestions } from '../src/evals/questions'
import { toMarkdown, type Report } from '../src/evals/report'
import { runEval } from '../src/evals/run'
import { score } from '../src/evals/score'
import { chat } from '../src/llm'
import { CANDIDATES, FUSED, retrieve, TOP } from '../src/search/retrieve'

const git = (args: string) => execSync(`git ${args}`, { encoding: 'utf8' }).trim()

async function main() {
  const cfg = getConfig()
  const questions = loadQuestions()
  const started = new Date()
  try {
    const records = await runEval(questions, { retrieve, chat }, (r, i) => {
      const res = r.result
      const status = !res ? `error: ${r.error}` : res.answerable ? 'answered' : `IDK ${res.reason}`
      console.log(`${String(i).padStart(2)}/${questions.length} ${r.question.id} ${status}`)
    })
    const report: Report = {
      meta: {
        date: started.toISOString(),
        commit: git('rev-parse --short HEAD') + (git('status --porcelain') ? '-dirty' : ''),
        provider: cfg.LLM_PROVIDER,
        models: { chat: cfg.CHAT_MODEL, embed: cfg.EMBED_MODEL, rerank: cfg.RERANK_MODEL },
        knobs: { candidates: CANDIDATES, fused: FUSED, top: TOP, idkThreshold: IDK_THRESHOLD },
        questions: questions.length,
        durationMs: Date.now() - started.getTime(),
      },
      scores: score(records),
      records,
    }
    const dir = join(process.cwd(), 'evals/reports')
    const base = join(dir, started.toISOString().slice(0, 16).replace(/[T:]/g, '-'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${base}.json`, JSON.stringify(report, null, 2) + '\n')
    writeFileSync(`${base}.md`, toMarkdown(report))
    console.table(report.scores)
    console.log(`wrote ${base}.json and ${base}.md`)
  } finally {
    await getDb().end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
