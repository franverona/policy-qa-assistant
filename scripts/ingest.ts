// Loads the corpus into Postgres. Usage: pnpm ingest [--force]
// --force re-ingests unchanged docs too: use it after changing the parser or chunker.
import { getConfig } from '../src/config'
import { getDb } from '../src/db/client'
import { ingest } from '../src/ingest/ingest'
import { embed } from '../src/llm'

async function main() {
  const { EMBED_MODEL, EMBED_DIM } = getConfig()
  const sql = getDb()
  try {
    const force = process.argv.includes('--force')
    const r = await ingest(sql, embed, { embedModel: EMBED_MODEL, embedDim: EMBED_DIM, force })
    for (const id of r.ingested) console.log(`ingested  ${id}`)
    for (const id of r.removed) console.log(`removed   ${id}`)
    console.log(
      `${r.ingested.length} ingested, ${r.skipped.length} unchanged, ${r.removed.length} removed`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
