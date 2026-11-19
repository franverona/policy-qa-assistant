import path from 'node:path'
import { z } from 'zod'
import { getConfig, type Config } from '../config'
import { fixtureKey, readFixture, writeFixture } from './fixtures'
import { postOllama } from './ollama'

export type Message = { role: 'system' | 'user' | 'assistant'; content: string }
export type Usage = { inputTokens: number; outputTokens: number }
export type EmbedKind = 'query' | 'document'

type LlmConfig = Pick<
  Config,
  | 'LLM_PROVIDER'
  | 'OLLAMA_BASE_URL'
  | 'CHAT_MODEL'
  | 'EMBED_MODEL'
  | 'EMBED_DIM'
  | 'EMBED_QUERY_PREFIX'
  | 'EMBED_DOC_PREFIX'
>

// Only the fields we read; Ollama's responses carry more (timings, model, ...).
const ChatResponse = z.object({
  message: z.object({ content: z.string() }),
  prompt_eval_count: z.number(),
  eval_count: z.number(),
})
const EmbedResponse = z.object({ embeddings: z.array(z.array(z.number())) })

export const FIXTURE_DIR = path.join(process.cwd(), 'fixtures/llm')

export function createLlm(cfg: LlmConfig, fixtureDir = FIXTURE_DIR) {
  // ollama: call it · record: call it and save the exchange · fixture: replay, never call.
  async function send(
    op: 'chat' | 'embed',
    body: { model: string } & Record<string, unknown>,
  ): Promise<unknown> {
    const { model, ...request } = body
    const key = fixtureKey(op, request)
    if (cfg.LLM_PROVIDER === 'fixture') return readFixture(fixtureDir, key)
    const response = await postOllama(cfg.OLLAMA_BASE_URL, `/api/${op}`, body)
    if (cfg.LLM_PROVIDER === 'record')
      await writeFixture(fixtureDir, key, { model, request, response })
    return response
  }

  return {
    async chat<T>(messages: Message[], schema: z.ZodType<T>): Promise<{ data: T; usage: Usage }> {
      if (cfg.LLM_PROVIDER === 'anthropic')
        throw new Error('LLM_PROVIDER=anthropic arrives in m5-anthropic-provider')
      const res = ChatResponse.parse(
        await send('chat', {
          model: cfg.CHAT_MODEL,
          messages,
          format: z.toJSONSchema(schema), // constrains decoding to this JSON shape
          stream: false,
          think: false, // qwen3 would otherwise write a long reasoning trace first
          options: { temperature: 0 }, // repeatable answers for evals
        }),
      )
      return {
        data: schema.parse(JSON.parse(res.message.content)),
        usage: { inputTokens: res.prompt_eval_count, outputTokens: res.eval_count },
      }
    },

    // Anthropic has no embeddings API, so embeddings always come from Ollama (or fixtures).
    async embed(texts: string[], kind: EmbedKind): Promise<number[][]> {
      const prefix = kind === 'query' ? cfg.EMBED_QUERY_PREFIX : cfg.EMBED_DOC_PREFIX
      const { embeddings } = EmbedResponse.parse(
        await send('embed', { model: cfg.EMBED_MODEL, input: texts.map((t) => prefix + t) }),
      )
      const bad = embeddings.find((e) => e.length !== cfg.EMBED_DIM)
      if (bad || embeddings.length !== texts.length)
        throw new Error(
          `${cfg.EMBED_MODEL} returned ${embeddings.length} vectors of ${bad?.length ?? cfg.EMBED_DIM} dims; expected ${texts.length} of EMBED_DIM=${cfg.EMBED_DIM}`,
        )
      return embeddings
    },
  }
}

let cached: ReturnType<typeof createLlm> | undefined
const llm = () => (cached ??= createLlm(getConfig()))

export function chat<T>(messages: Message[], schema: z.ZodType<T>) {
  return llm().chat(messages, schema)
}

export function embed(texts: string[], kind: EmbedKind) {
  return llm().embed(texts, kind)
}
