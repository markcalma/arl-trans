/**
 * One-time Google OAuth setup script.
 *
 * Run once before starting the dashboard:
 *   npx ts-node --project tsconfig.scripts.json scripts/google-auth.ts
 *
 * Prerequisites:
 *   1. Create a Google Cloud project at console.cloud.google.com
 *   2. Enable Gmail API and Google Sheets API
 *   3. Create OAuth 2.0 credentials (Desktop app type)
 *   4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local
 *   5. Run this script — it will open a URL, you paste the code back
 */

import * as readline from 'readline'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

async function main() {
  const { getAuthUrl, exchangeCode } = await import('../lib/gmail')

  console.log('\nARL-Trans — Google OAuth Setup\n')
  console.log('Open this URL in your browser:\n')
  console.log(getAuthUrl())
  console.log('\nAfter authorizing, paste the code below.\n')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const code = await new Promise<string>((resolve) => {
    rl.question('Authorization code: ', (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })

  await exchangeCode(code)
  console.log('\nSetup complete. You can now run: npm run dev\n')
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
