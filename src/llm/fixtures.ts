import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// `request` excludes the model name, so changing CHAT_MODEL doesn't invalidate CI fixtures.
export function fixtureKey(op: string, request: unknown): string {
  const hash = createHash('sha256').update(JSON.stringify(request)).digest('hex')
  return `${op}-${hash.slice(0, 12)}`
}

export async function readFixture(dir: string, key: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path.join(dir, `${key}.json`), 'utf8')).response
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    throw new Error(
      `No LLM fixture ${key}.json in ${dir}: run this flow once with LLM_PROVIDER=record (needs Ollama).`,
    )
  }
}

export async function writeFixture(
  dir: string,
  key: string,
  data: { model: string; request: unknown; response: unknown },
): Promise<void> {
  await mkdir(dir, { recursive: true })
  const body = { ...data, recordedAt: new Date().toISOString() }
  await writeFile(path.join(dir, `${key}.json`), JSON.stringify(body, null, 2) + '\n')
}
