import postgres from 'postgres'
import { migrate, MIGRATE_LOCK } from './migrate'

// A migrated schema of its own, so a db test never touches the dev data. Undefined without
// DATABASE_URL (vitest doesn't load .env): pair with describe.skipIf.
export function testSchema(name: string) {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  const sql = postgres(url, { onnotice: () => {}, connection: { search_path: `${name}, public` } })
  return {
    sql,
    async setup() {
      await sql`drop schema if exists ${sql(name)} cascade`
      await sql`create schema ${sql(name)}`
      // The extension must live in public: dropping the schema would otherwise drop it too.
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${MIGRATE_LOCK})`
        await tx`create extension if not exists vector schema public`
      })
      await migrate(sql)
    },
    async teardown() {
      await sql`drop schema if exists ${sql(name)} cascade`
      await sql.end()
    },
  }
}
