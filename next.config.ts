import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  agentRules: false, // we keep agent instructions in CLAUDE.md; stops next dev writing AGENTS.md
  cacheComponents: true,
  partialPrefetching: true,
}

export default nextConfig
