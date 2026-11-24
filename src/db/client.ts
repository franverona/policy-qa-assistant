import postgres, { type Sql } from 'postgres'
import { getConfig } from '../config'

let cached: Sql | undefined

// Lazy, like getConfig: one pool per process, created on first query.
export function getDb(): Sql {
  return (cached ??= postgres(getConfig().DATABASE_URL))
}
