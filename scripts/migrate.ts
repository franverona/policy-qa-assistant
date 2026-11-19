import postgres from 'postgres'
import { z } from 'zod'
import { migrate } from '../src/db/migrate'

async function main() {
  // Only DATABASE_URL: getConfig() also requires model variables that migrating doesn't need.
  const url = z.url().parse(process.env.DATABASE_URL, { error: () => 'DATABASE_URL is missing' })
  const sql = postgres(url, { onnotice: () => {} })
  try {
    const applied = await migrate(sql)
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Up to date')
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
