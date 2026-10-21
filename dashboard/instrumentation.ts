export async function register() {
  // Only run in the Node.js runtime (not in Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Seed Google tokens from env var before poller starts (Railway first-run)
    if (process.env.GOOGLE_TOKENS_JSON) {
      const fs = await import('fs')
      const path = await import('path')
      const tokensPath = path.join(process.cwd(), 'data', 'google-tokens.json')
      if (!fs.existsSync(tokensPath)) {
        fs.mkdirSync(path.dirname(tokensPath), { recursive: true })
        fs.writeFileSync(tokensPath, process.env.GOOGLE_TOKENS_JSON)
        console.log('[instrumentation] Seeded google-tokens.json from GOOGLE_TOKENS_JSON env var')
      }
    }

    const { startPoller } = await import('./lib/poller')
    startPoller()
  }
}
