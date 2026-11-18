import { z } from 'zod'

// Corpus source format: `---` frontmatter (key: value lines), then a Markdown subset:
// `# ` title, `## ` section, `### ` clause, `- ` bullet, blank-line separated paragraphs.

const Meta = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  type: z.enum(['policy', 'wiki']),
  code: z.string().min(1).optional(),
  effective: z.iso.date().optional(),
})
export type Meta = z.infer<typeof Meta>

export type Block =
  | { kind: 'title' | 'section' | 'clause'; text: string; anchor: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }

export type SourceDoc = { meta: Meta; blocks: Block[] }

const HEADINGS = { '#': 'title', '##': 'section', '###': 'clause' } as const

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function parseSource(raw: string, file = 'source'): SourceDoc {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`${file}: missing --- frontmatter ---`)
  const fields = Object.fromEntries(
    match[1].split('\n').map((line) => {
      const i = line.indexOf(':')
      if (i < 0) throw new Error(`${file}: bad frontmatter line "${line}"`)
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
  )
  const meta = Meta.safeParse(fields)
  if (!meta.success) throw new Error(`${file}: ${z.prettifyError(meta.error)}`)

  const blocks: Block[] = []
  const anchors = new Set<string>()
  for (const chunk of match[2].split(/\n\s*\n/)) {
    const lines = chunk.trim().split('\n')
    if (!lines[0]) continue
    const heading = lines[0].match(/^(#{1,3}) (.+)$/)
    if (heading) {
      if (lines.length > 1)
        throw new Error(`${file}: heading "${lines[0]}" needs a blank line after it`)
      const anchor = slug(heading[2])
      if (anchors.has(anchor)) throw new Error(`${file}: duplicate heading anchor "${anchor}"`)
      anchors.add(anchor)
      blocks.push({ kind: HEADINGS[heading[1] as keyof typeof HEADINGS], text: heading[2], anchor })
    } else if (lines[0].startsWith('- ')) {
      if (!lines.every((l) => l.startsWith('- ')))
        throw new Error(`${file}: mixed list "${lines[0]}"`)
      blocks.push({ kind: 'list', items: lines.map((l) => l.slice(2).trim()) })
    } else {
      blocks.push({ kind: 'paragraph', text: lines.map((l) => l.trim()).join(' ') })
    }
  }
  if (blocks[0]?.kind !== 'title') throw new Error(`${file}: must start with a # title`)
  return { meta: meta.data, blocks }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Wiki pages become standalone HTML; every heading gets an id so citations can link `#anchor`.
export function toHtml({ meta, blocks }: SourceDoc): string {
  const tags = { title: 'h1', section: 'h2', clause: 'h3' } as const
  const body = blocks.map((b) => {
    if (b.kind === 'paragraph') return `<p>${esc(b.text)}</p>`
    if (b.kind === 'list')
      return `<ul>\n${b.items.map((i) => `  <li>${esc(i)}</li>`).join('\n')}\n</ul>`
    return `<${tags[b.kind]} id="${b.anchor}">${esc(b.text)}</${tags[b.kind]}>`
  })
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${esc(meta.title)}</title>`,
    `<meta name="doc-id" content="${meta.id}">`,
    '</head>',
    '<body>',
    ...body,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}
