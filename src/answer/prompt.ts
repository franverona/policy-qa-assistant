import type { Message } from '../llm'
import type { SearchHit } from '../search/fulltext'

export const SYSTEM_PROMPT = `You answer questions from Harborline Mutual support agents. Use ONLY the numbered sources below; never use outside knowledge.
- If the sources do not contain the answer, set "answerable" to false and "answer" to "".
- Otherwise answer in 1-4 short sentences. End every sentence with the source number(s) it comes from, like [2] or [1][3].
- Copy amounts, limits, waiting periods and policy codes exactly as written.
- If sources disagree (different products or years), say which source says what.`

// What an agent clicks to open the source: page for PDFs, anchor for wiki pages.
export const citeLabel = (h: Pick<SearchHit, 'documentId' | 'page' | 'anchor'>) =>
  `${h.documentId} ${h.page ? `p.${h.page}` : `#${h.anchor}`}`

// Where that link goes: the /docs viewer, at the cited page or anchor.
export const citeHref = (h: Pick<SearchHit, 'documentId' | 'page' | 'anchor'>) =>
  `/docs/${encodeURIComponent(h.documentId)}#${h.page ? `page=${h.page}` : h.anchor}`

// Sources are numbered [1]..[n]; the model cites those numbers, never chunk ids.
export function buildMessages(question: string, hits: SearchHit[]): Message[] {
  const sources = hits
    .map((h, i) => `[${i + 1}] ${h.headingPath} (${citeLabel(h)})\n${h.content}`)
    .join('\n\n')
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Sources:\n\n${sources}\n\nQuestion: ${question}` },
  ]
}
