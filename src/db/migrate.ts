import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Sql } from 'postgres'

const DIR = path.join(process.cwd(), 'db/migrations')
export const MIGRATE_LOCK = 7_331_001

// Applies db/migrations/*.sql not yet recorded, in name order, one transaction per file.
export async function migrate(sql: Sql): Promise<string[]> {
  await sql`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`
  const done = new Set((await sql`select name from schema_migrations`).map((r) => r.name))
  const pending = (await readdir(DIR)).filter((f) => f.endsWith('.sql') && !done.has(f)).sort()
  for (const name of pending) {
    const body = await readFile(path.join(DIR, name), 'utf8')
    await sql.begin(async (tx) => {
      // Serialises concurrent migrations (e.g. parallel test files on a fresh db), so two
      // `create extension if not exists` can't race. Released at commit.
      await tx`select pg_advisory_xact_lock(${MIGRATE_LOCK})`
      await tx.unsafe(body)
      await tx`insert into schema_migrations (name) values (${name})`
    })
  }
  return pending
}
