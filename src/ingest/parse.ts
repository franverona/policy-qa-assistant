import { getDocumentProxy } from 'unpdf'

// Parsers turn a rendered file into heading-delimited sections, the unit the chunker works on.

export type Para = { text: string; page?: number }
export type Section = { path: string[]; anchor?: string; paras: Para[] } // path: [title, section?, clause?]

type Item = { str: string; height: number; transform: number[] }

// Headings are found by font size, as in any PDF without tags: the most common size is body
// text, larger sizes (largest first) are heading levels, smaller text (subtitles) is skipped.
export async function parsePdf(data: Uint8Array): Promise<Section[]> {
  const pdf = await getDocumentProxy(data)
  const pages: Item[][] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const { items } = await (await pdf.getPage(n)).getTextContent()
    pages.push((items as Item[]).filter((i) => i.str?.trim()))
  }

  const size = (i: Item) => Math.round(i.height * 10) / 10
  const weight = new Map<number, number>()
  for (const i of pages.flat()) weight.set(size(i), (weight.get(size(i)) ?? 0) + i.str.length)
  const body = [...weight].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
  const levels = [...weight.keys()].filter((s) => s > body).sort((a, b) => b - a)

  const sections: Section[] = []
  const path: string[] = []
  let heading: { level: number; text: string } | undefined // consecutive heading lines join up
  let para: Para | undefined
  let lastY = 0

  pages.forEach((items, p) => {
    for (const item of items) {
      const s = size(item)
      const y = item.transform[5]
      const level = levels.indexOf(s)
      if (level >= 0) {
        const wrapped = heading?.level === level // a long heading continues on the next line
        heading = wrapped
          ? { level, text: `${heading!.text} ${item.str}` }
          : { level, text: item.str }
        path.length = level
        path[level] = heading.text.replace(/\s+/g, ' ').trim()
        if (wrapped) sections.pop()
        sections.push({ path: [...path], paras: [] })
        para = undefined
      } else if (s === body) {
        heading = undefined
        const section = sections.at(-1)
        if (!section) continue // body text before the first heading
        // A gap wider than 1.5 lines on the same page starts a new paragraph.
        if (!para || (y < lastY && lastY - y > body * 1.5)) {
          para = { text: '', page: p + 1 }
          section.paras.push(para)
        }
        // Lines wrap after the hyphen of a compound word ("non-" / "payment"): no space there.
        const sep = para.text.endsWith('-') ? '' : ' '
        para.text = (para.text + sep + item.str).replace(/\s+/g, ' ').trim()
        lastY = y
      }
    }
  })
  return sections
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

// shortcut: only handles our renderer's HTML (toHtml in src/corpus/source.ts); switch to
// node-html-parser or parse5 when real wiki exports arrive.
export function parseHtml(html: string): Section[] {
  const sections: Section[] = []
  const path: string[] = []
  const tags = /<h([1-3]) id="([^"]*)">([\s\S]*?)<\/h\1>|<(p|li)>([\s\S]*?)<\/\4>/g
  for (const m of html.matchAll(tags)) {
    if (m[1]) {
      const level = Number(m[1]) - 1
      path.length = level
      path[level] = decode(m[3]).trim()
      sections.push({ path: [...path], anchor: m[2], paras: [] })
    } else {
      sections.at(-1)?.paras.push({ text: decode(m[5]).replace(/\s+/g, ' ').trim() })
    }
  }
  return sections
}
