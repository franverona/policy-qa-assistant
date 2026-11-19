// POSTs JSON to Ollama's HTTP API (https://docs.ollama.com/api) and returns the parsed body.
export async function postOllama(baseUrl: string, path: string, body: unknown): Promise<unknown> {
  const url = new URL(path, baseUrl)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (err) {
    throw new Error(`Ollama at ${url} unreachable or timed out (is \`ollama serve\` running?)`, {
      cause: err,
    })
  }
  if (!res.ok) throw new Error(`Ollama ${path} failed (${res.status}): ${await res.text()}`)
  return res.json()
}
