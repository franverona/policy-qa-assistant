import type { Metadata } from 'next'
import Form from 'next/form'
import { Suspense } from 'react'
import { citeLabel } from '@/answer/prompt'
import { retrieve, TOP } from '@/search/retrieve'

export const metadata: Metadata = { title: 'Search debug · Policy Q&A Assistant' }

// Developer page: shows how each chunk got its place (full-text rank, vector rank, RRF score,
// rerank score) for one query.
export default function SearchPage({ searchParams }: PageProps<'/search'>) {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Search debug</h1>
      <Suspense fallback={<p className="mt-6 text-gray-500">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function Results({ searchParams }: Pick<PageProps<'/search'>, 'searchParams'>) {
  const { q } = await searchParams
  const query = typeof q === 'string' ? q.trim() : ''
  const form = (
    <Form action="/search" className="mt-4 flex gap-2">
      <input
        name="q"
        defaultValue={query}
        placeholder="Does HomeShield cover sump pump overflow?"
        aria-label="Query"
        className="flex-1 rounded border border-gray-300 px-3 py-2"
      />
      <button className="rounded bg-gray-900 px-4 py-2 text-white">Search</button>
    </Form>
  )
  if (!query) return form

  const { hits, searchMs, rerankMs } = await retrieve(query)

  return (
    <>
      {form}
      <p className="mt-3 text-sm text-gray-500">
        Embed + search {searchMs} ms · rerank {hits.length} in {rerankMs} ms · top {TOP} highlighted
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">Rerank</th>
              <th className="p-2">RRF</th>
              <th className="p-2">FT</th>
              <th className="p-2">Vec</th>
              <th className="p-2">Chunk</th>
              <th className="p-2">Cite</th>
            </tr>
          </thead>
          <tbody>
            {hits.map((h, i) => (
              <tr
                key={h.chunkId}
                className={i < TOP ? 'border-b bg-amber-50 align-top' : 'border-b align-top'}
              >
                <td className="p-2">{i + 1}</td>
                <td className="p-2 font-mono">{h.rerankScore.toFixed(3)}</td>
                <td className="p-2 font-mono">{h.score.toFixed(4)}</td>
                <td className="p-2 font-mono">{h.ranks[0] ?? '–'}</td>
                <td className="p-2 font-mono">{h.ranks[1] ?? '–'}</td>
                <td className="p-2">
                  <details>
                    <summary className="cursor-pointer">{h.headingPath}</summary>
                    <p className="mt-2 whitespace-pre-wrap text-gray-700">{h.content}</p>
                  </details>
                </td>
                <td className="p-2 whitespace-nowrap text-gray-500">{citeLabel(h)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
