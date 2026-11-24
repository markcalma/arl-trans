import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Don't bundle native addons — load from node_modules at runtime so the
  // local Windows build can be deployed to Linux without hash mismatches.
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
