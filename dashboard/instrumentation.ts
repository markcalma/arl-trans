export async function register() {
  // Only run in the Node.js runtime (not in Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startPoller } = await import('./lib/poller')
    startPoller()
  }
}
