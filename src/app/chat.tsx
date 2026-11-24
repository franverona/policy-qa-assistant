'use client'

import { useState, type FormEvent } from 'react'
import type { AnswerResult, Citation } from '@/answer/answer'
import { citeHref, citeLabel } from '@/answer/prompt'

type Turn = { question: string; result?: AnswerResult; error?: string }

const REASONS = {
  low_retrieval_score: 'No retrieved source was relevant enough.',
  model_declined: 'The retrieved sources do not answer this.',
  no_valid_citations: 'The model answered without citing a source, so the answer was withheld.',
}

// Each question is answered on its own: the pipeline has no conversation memory.
export function Chat() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, setPending] = useState(false)
  const [selected, setSelected] = useState<Citation>()

  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const question = String(new FormData(form).get('question') ?? '').trim()
    if (!question || pending) return
    setPending(true)
    setTurns((t) => [...t, { question }])
    const turn: Turn = { question }
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
      turn.result = (await res.json()) as AnswerResult
      if (turn.result.answerable) setSelected(turn.result.citations[0])
      form.reset()
    } catch (err) {
      turn.error = err instanceof Error ? err.message : String(err)
    }
    setTurns((t) => [...t.slice(0, -1), turn])
    setPending(false)
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
      <section aria-label="Conversation" className="flex flex-col gap-4">
        {turns.map((t, i) => (
          <article key={i} className="flex flex-col gap-2">
            <p className="self-end rounded-lg bg-gray-900 px-3 py-2 text-white">{t.question}</p>
            <Reply turn={t} selected={selected} onSelect={setSelected} />
          </article>
        ))}
        <form onSubmit={ask} className="flex gap-2">
          <input
            name="question"
            maxLength={500}
            required
            placeholder="Does HomeShield cover sump pump overflow?"
            aria-label="Question"
            className="flex-1 rounded border border-gray-300 px-3 py-2"
          />
          <button
            disabled={pending}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {pending ? 'Answering…' : 'Ask'}
          </button>
        </form>
      </section>
      <SourcePanel citation={selected} />
    </div>
  )
}

function Reply({
  turn,
  selected,
  onSelect,
}: {
  turn: Turn
  selected?: Citation
  onSelect: (c: Citation) => void
}) {
  const { result, error } = turn
  if (error) return <p className="text-red-700">Something went wrong ({error}).</p>
  if (!result) return <p className="text-gray-500">Searching the policies…</p>
  if (!result.answerable)
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
        <p>{result.answer}</p>
        <p className="mt-1 text-sm text-gray-600">{REASONS[result.reason]}</p>
      </div>
    )
  // split with a capture group: odd parts are the n of each [n] marker.
  return (
    <p className="rounded-lg border border-gray-200 px-3 py-2 leading-7">
      {result.answer.split(/\[(\d+)\]/).map((part, i) => {
        if (i % 2 === 0) return part
        const c = result.citations.find((c) => c.n === Number(part))
        if (!c) return null
        const active = selected?.chunkId === c.chunkId
        return (
          <button
            key={i}
            onClick={() => onSelect(c)}
            aria-pressed={active}
            aria-label={`Source ${c.n}: ${citeLabel(c)}`}
            className={`mx-0.5 rounded px-1.5 align-baseline font-mono text-xs ${active ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
          >
            {c.n}
          </button>
        )
      })}
    </p>
  )
}

function SourcePanel({ citation: c }: { citation?: Citation }) {
  return (
    <aside
      aria-label="Source"
      className="self-start rounded-lg border border-gray-200 p-4 lg:sticky lg:top-8"
    >
      {c ? (
        <>
          <h2 className="font-semibold">{c.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{c.headingPath}</p>
          <p className="mt-3 text-sm whitespace-pre-wrap">{c.content}</p>
          <a
            href={citeHref(c)}
            target="_blank"
            className="mt-3 inline-block text-sm text-blue-700 underline"
          >
            Open {citeLabel(c)}
          </a>
        </>
      ) : (
        <p className="text-sm text-gray-500">Click a source number to see the cited clause.</p>
      )}
    </aside>
  )
}
