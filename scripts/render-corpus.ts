// Renders corpus/sources/*.md: policies to PDF, wiki pages to HTML, into corpus/rendered/.
// Usage: pnpm corpus:render
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import PDFDocument from 'pdfkit'
import { parseSource, toHtml, type SourceDoc } from '../src/corpus/source'

const SRC = 'corpus/sources'
const OUT = 'corpus/rendered'

function toPdf({ meta, blocks }: SourceDoc): Promise<Buffer> {
  // Fixed dates and built-in fonts keep the output byte-identical between runs.
  const date = new Date(`${meta.effective ?? '2024-01-01'}T00:00:00Z`)
  const doc = new PDFDocument({
    size: 'A4',
    margin: 64,
    info: { Title: meta.title, Author: 'Harborline Mutual', CreationDate: date, ModDate: date },
  })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))
  // Keep a heading on the same page as its first lines, so a clause's page is where its text starts.
  const keepWithNext = (height: number) => {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage()
  }

  for (const b of blocks) {
    if (b.kind === 'title') {
      doc.font('Helvetica-Bold').fontSize(18).text(b.text)
      const sub = [
        meta.code && `Policy form ${meta.code}`,
        meta.effective && `Effective ${meta.effective}`,
      ]
      doc.font('Helvetica').fontSize(9).fillColor('#555').text(sub.filter(Boolean).join(' · '))
      doc.fillColor('black').moveDown(1.5)
    } else if (b.kind === 'section') {
      // Section heading + clause heading + ~3 body lines.
      keepWithNext(80)
      doc.moveDown(0.5).font('Helvetica-Bold').fontSize(13).text(b.text).moveDown(0.4)
    } else if (b.kind === 'clause') {
      // Clause heading + ~3 body lines.
      keepWithNext(55)
      doc.font('Helvetica-Bold').fontSize(10.5).text(b.text).moveDown(0.2)
    } else if (b.kind === 'paragraph') {
      doc.font('Helvetica').fontSize(10).text(b.text, { align: 'justify' }).moveDown(0.6)
    } else if (b.kind === 'list') {
      doc
        .font('Helvetica')
        .fontSize(10)
        .list(b.items, { bulletIndent: 8, textIndent: 16 })
        .moveDown(0.6)
    }
  }
  doc.end()
  return done
}

async function main() {
  const files = readdirSync(SRC).filter((f) => f.endsWith('.md'))
  mkdirSync(OUT, { recursive: true })
  for (const file of files) {
    const source = parseSource(readFileSync(join(SRC, file), 'utf8'), file)
    const { id, type } = source.meta
    if (type === 'policy') writeFileSync(join(OUT, `${id}.pdf`), await toPdf(source))
    else writeFileSync(join(OUT, `${id}.html`), toHtml(source))
  }
  console.log(`Rendered ${files.length} docs into ${OUT}/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
