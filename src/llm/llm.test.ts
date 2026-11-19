import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { fixtureKey } from './fixtures'
import { createLlm } from '.'
import { smoke } from './smoke'

const cfg = {
  LLM_PROVIDER: 'ollama',
  OLLAMA_BASE_URL: 'http://ollama.test:11434',
  CHAT_MODEL: 'qwen3:8b',
  EMBED_MODEL: 'nomic-embed-text',
  EMBED_DIM: 3,
  EMBED_QUERY_PREFIX: 'search_query: ',
  EMBED_DOC_PREFIX: 'search_document: ',
} as const

const Answer = z.object({ answer: z.string() })
const msgs = [{ role: 'user' as const, content: 'What is a deductible?' }]
const chatReply = (content: string) => ({
  message: { content },
  prompt_eval_count: 12,
  eval_count: 7,
})

function stubFetch(body: unknown) {
  const fetch = vi.fn(async () => Response.json(body))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const sentBody = (fetch: ReturnType<typeof stubFetch>) =>
  JSON.parse((fetch.mock.calls[0] as unknown as [URL, RequestInit])[1].body as string)

afterEach(() => vi.unstubAllGlobals())

describe('ollama provider', () => {
  it('sends a schema-constrained, deterministic chat and returns typed data + usage', async () => {
    const fetch = stubFetch(chatReply('{"answer":"The part you pay."}'))
    const res = await createLlm(cfg).chat(msgs, Answer)
    expect(res).toEqual({
      data: { answer: 'The part you pay.' },
      usage: { inputTokens: 12, outputTokens: 7 },
    })
    expect(sentBody(fetch)).toMatchObject({
      model: 'qwen3:8b',
      format: { type: 'object', properties: { answer: { type: 'string' } } },
      stream: false,
      think: false,
      options: { temperature: 0 },
    })
  })

  it('rejects a reply that does not match the schema', async () => {
    stubFetch(chatReply('{"answer":42}'))
    await expect(createLlm(cfg).chat(msgs, Answer)).rejects.toThrow()
  })

  it('adds the task prefix for the embedding kind', async () => {
    const fetch = stubFetch({ embeddings: [[1, 2, 3]] })
    await createLlm(cfg).embed(['water backup'], 'query')
    expect(sentBody(fetch).input).toEqual(['search_query: water backup'])
  })

  it('rejects vectors whose length is not EMBED_DIM', async () => {
    stubFetch({ embeddings: [[1, 2]] })
    await expect(createLlm(cfg).embed(['x'], 'document')).rejects.toThrow(/EMBED_DIM=3/)
  })

  it('explains an HTTP error', async () => {
    vi.stubGlobal('fetch', async () => new Response('model not found', { status: 404 }))
    await expect(createLlm(cfg).embed(['x'], 'query')).rejects.toThrow(/404.*model not found/)
  })

  it('refuses anthropic chat until M5', async () => {
    await expect(
      createLlm({ ...cfg, LLM_PROVIDER: 'anthropic' }).chat(msgs, Answer),
    ).rejects.toThrow(/m5-anthropic-provider/)
  })
})

describe('record and fixture providers', () => {
  it('records once, then replays without calling Ollama, even after a model change', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'llm-'))
    stubFetch(chatReply('{"answer":"recorded"}'))
    await createLlm({ ...cfg, LLM_PROVIDER: 'record' }, dir).chat(msgs, Answer)
    expect(await readdir(dir)).toEqual([expect.stringMatching(/^chat-[0-9a-f]{12}\.json$/)])

    const fetch = stubFetch({})
    const replayCfg = { ...cfg, LLM_PROVIDER: 'fixture', CHAT_MODEL: 'llama3.1:8b' } as const
    const replay = await createLlm(replayCfg, dir).chat(msgs, Answer)
    expect(replay.data.answer).toBe('recorded')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('tells you how to record a missing fixture', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'llm-'))
    await expect(
      createLlm({ ...cfg, LLM_PROVIDER: 'fixture' }, dir).embed(['x'], 'query'),
    ).rejects.toThrow(/LLM_PROVIDER=record/)
  })

  it('gives a different key when the request changes', () => {
    expect(fixtureKey('chat', { messages: msgs })).toBe(fixtureKey('chat', { messages: msgs }))
    expect(fixtureKey('chat', { messages: msgs })).not.toBe(fixtureKey('chat', { messages: [] }))
  })

  it('replays the real Ollama responses recorded by `pnpm llm:smoke`', async () => {
    const res = await smoke(createLlm({ ...cfg, LLM_PROVIDER: 'fixture', EMBED_DIM: 768 }))
    expect(res.answer.length).toBeGreaterThan(0)
    expect(res).toMatchObject({ dims: 768, docs: 2 })
    expect(res.usage.outputTokens).toBeGreaterThan(0)
  })
})
