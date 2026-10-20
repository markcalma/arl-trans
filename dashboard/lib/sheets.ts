import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { WFDOOrder } from './types'

const TOKENS_PATH = path.join(process.cwd(), 'google-tokens.json')

function getAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob')

  if (!fs.existsSync(TOKENS_PATH)) {
    throw new Error('Google tokens not found. Run: npx ts-node scripts/google-auth.ts')
  }
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))
  oauth2.setCredentials(tokens)

  oauth2.on('tokens', (newTokens) => {
    const existing = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))
    fs.writeFileSync(TOKENS_PATH, JSON.stringify({ ...existing, ...newTokens }, null, 2))
  })

  return oauth2
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID
  if (!id) throw new Error('GOOGLE_SHEET_ID must be set')
  return id
}

// ---------------------------------------------------------------------------
// Read the first row of a tab to discover column headers
// ---------------------------------------------------------------------------
export async function getSheetHeaders(tabName: string): Promise<string[]> {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: `${tabName}!1:1`,
  })
  return (res.data.values?.[0] ?? []) as string[]
}

// ---------------------------------------------------------------------------
// Append a row to Load Board tab
//
// Inspect the tab headers before changing this function — the column order
// comes from the existing sheet, not from this code.
// ---------------------------------------------------------------------------
export async function appendToLoadBoard(order: WFDOOrder): Promise<void> {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })

  // Column order matches the existing Load Board tab.
  // Run getSheetHeaders('Load Board') to verify if columns change.
  const row = [
    order.receivedAt ? new Date(order.receivedAt).toLocaleDateString('en-US') : '',
    order.containerNumber,
    order.masterBL,
    order.consignee,
    order.portLocation,
    order.arrivalDate,
    order.cargoDescription,
    order.packages,
    order.carrierEmail,
    order.sentAt ? new Date(order.sentAt).toLocaleDateString('en-US') : '',
    'Sent',
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: 'Load Board!A:A',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}

// ---------------------------------------------------------------------------
// Append a row to Master Container List tab
// ---------------------------------------------------------------------------
export async function appendToMasterList(order: WFDOOrder): Promise<void> {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })

  // Column order matches the existing Master Container List tab.
  const row = [
    order.containerNumber,
    order.masterBL,
    order.consignee,
    order.arrivalDate,
    order.portLocation,
    order.cargoDescription,
    order.packages,
    order.weightKg,
    order.weightLb,
    order.sealNumber,
    order.nvoName,
    order.receivedAt ? new Date(order.receivedAt).toLocaleDateString('en-US') : '',
    'DO Sent',
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: 'Master Container List!A:A',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}
