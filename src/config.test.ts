import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  LLM_PROVIDER: "ollama",
  OLLAMA_BASE_URL: "http://localhost:11434",
  CHAT_MODEL: "qwen3:8b",
  EMBED_MODEL: "nomic-embed-text",
  EMBED_DIM: "768",
  RERANK_MODEL: "Xenova/bge-reranker-base",
};

describe("parseConfig", () => {
  it("parses a complete env and coerces numbers", () => {
    expect(parseConfig(valid).EMBED_DIM).toBe(768);
  });

  it("names every missing variable", () => {
    const { DATABASE_URL: _db, CHAT_MODEL: _chat, ...rest } = valid;
    expect(() => parseConfig(rest)).toThrow(
      /DATABASE_URL: missing[\s\S]*CHAT_MODEL: missing/,
    );
  });

  it("requires Anthropic settings only when that provider is selected", () => {
    expect(() => parseConfig({ ...valid, LLM_PROVIDER: "anthropic" })).toThrow(
      /ANTHROPIC_API_KEY.*required/,
    );
    const config = parseConfig({
      ...valid,
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "k",
      ANTHROPIC_MODEL: "m",
    });
    expect(config.LLM_PROVIDER).toBe("anthropic");
  });
});
