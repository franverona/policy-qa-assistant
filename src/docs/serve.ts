import { readFile } from 'node:fs/promises'
import type { Sql } from 'postgres'

// Wiki HTML gets a sandbox CSP: no scripts run even if a real wiki export carries some.
// Not for PDFs: a sandboxed document can't open the browser's PDF viewer.
const HEADERS = {
  policy: { 'content-type': 'application/pdf' },
  wiki: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': 'sandbox' },
}

// Serves a rendered corpus file by document id. The path comes from the documents table,
// never from the URL, so an id can't reach any other file. The browser handles the
// #page=N (PDF viewer) or #anchor (HTML) fragment of a citation link.
export async function serveDoc(sql: Sql, id: string): Promise<Response> {
  const [doc] = await sql<{ type: 'policy' | 'wiki'; path: string }[]>`
    select type, path from documents where id = ${id}`
  if (!doc) return new Response('Document not found', { status: 404 })
  return new Response(await readFile(doc.path), {
    headers: { ...HEADERS[doc.type], 'x-content-type-options': 'nosniff' },
  })
}
