import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { WFDOOrder, WF1Container } from './types'

const TOKENS_PATH = path.join(process.cwd(), 'data', 'google-tokens.json')

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

function getMasterSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID_MASTER
  if (!id) throw new Error('GOOGLE_SHEET_ID_MASTER must be set')
  return id
}

function getLoadBoardSheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID_LOADBOARD
  if (!id) throw new Error('GOOGLE_SHEET_ID_LOADBOARD must be set')
  return id
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

// "3-17" — used for column A of Master Container List
function formatShortDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
}

// "3-20-25" — used inside the "LT M-DD-YY" format for column K
function formatLTDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const yy = String(d.getFullYear()).slice(2)
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}-${yy}`
}

// ---------------------------------------------------------------------------
// Route delivery location → Load Board tab name
//
// Tabs: NEW NY/NJ LANES | Exton / PA | LOLO COMPLETE | VACAVILLE |
//       Ontario Amer | New Ontario (California Innovations) |
//       CARSON | STOCKTON | OAKLAND (Direct Del Sister Comp)
// ---------------------------------------------------------------------------
function resolveLoadBoardTab(deliveryLocation: string): string {
  const loc = (deliveryLocation ?? '').toUpperCase()

  if (loc.includes('VACAVILLE')) return 'VACAVILLE'
  if (loc.includes('CARSON')) return 'CARSON'
  if (loc.includes('STOCKTON')) return 'STOCKTON'
  if (loc.includes('OAKLAND')) return 'OAKLAND (Direct Del Sister Comp)'

  if (loc.includes('EXTON') || loc.includes('PENNSYLVANIA') ||
      /\bPA\b/.test(loc)) return 'Exton / PA'

  if (loc.includes('NEW YORK') || loc.includes('NEW JERSEY') ||
      /\bNY\b/.test(loc) || /\bNJ\b/.test(loc) ||
      loc.includes('NEWARK') || loc.includes('ELIZABETH')) return 'NEW NY/NJ LANES'

  if (loc.includes('CALIFORNIA INNOV') || loc.includes('CA INNOV')) {
    return 'New Ontario (California Innovations)'
  }

  if (loc.includes('ONTARIO') || loc.includes('FONTANA') ||
      loc.includes('CHINO') || loc.includes('RANCHO CUCAMONGA')) return 'Ontario Amer'

  console.warn(`[sheets] No tab match for delivery location "${deliveryLocation}" — defaulting to NEW NY/NJ LANES`)
  return 'NEW NY/NJ LANES'
}

// ---------------------------------------------------------------------------
// Read the first row of a tab (for debugging / verification)
// ---------------------------------------------------------------------------
export async function getSheetHeaders(sheetId: string, tabName: string): Promise<string[]> {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!1:1`,
  })
  return (res.data.values?.[0] ?? []) as string[]
}

// ---------------------------------------------------------------------------
// Upsert to Load Board — tab selected by delivery location
//
// Column order (all location tabs share this structure):
// A: SSL FREE DAYS  B: SSL  C: VESSEL  D: SIZE  E: Container #
// F: HOUSE BOL  G: Load #  H: REF #  I: Date DO RECEIVED  J: ETA
// K: DELIVERY LOCATION  L: TERMINAL  (M–AD filled later by ops team)
//
// WF-DO owns: E, F, I, J, K, L — A/B/C/D/G/H are WF1 / ops territory.
// If the container already exists: partial-update WF-DO columns only.
// If new: append a full row with WF1 columns left blank.
// ---------------------------------------------------------------------------
export async function appendToLoadBoard(order: WFDOOrder): Promise<void> {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = getLoadBoardSheetId()

  const deliveryLoc = order.consigneeAddress || order.portLocation || ''
  const tab = resolveLoadBoardTab(deliveryLoc)
  const doDate = order.receivedAt
    ? new Date(order.receivedAt).toLocaleDateString('en-US')
    : ''

  const existingMap = await readColumnIndex(sheets, spreadsheetId, tab, 'E')
  const existingRow = existingMap.get(order.containerNumber)

  if (existingRow) {
    // Partial update — only touch WF-DO-owned columns, leave A/B/C/D alone
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${tab}'!F${existingRow}`, values: [[order.masterBL || '']] },
          { range: `'${tab}'!I${existingRow}`, values: [[doDate]] },
          { range: `'${tab}'!J${existingRow}`, values: [[order.arrivalDate || '']] },
          { range: `'${tab}'!K${existingRow}`, values: [[deliveryLoc]] },
          { range: `'${tab}'!L${existingRow}`, values: [[order.portLocation || '']] },
        ],
      },
    })
    console.log(`[sheets] Load Board → updated row ${existingRow} in "${tab}" for ${order.containerNumber}`)
  } else {
    // New container — append full row; leave WF1 columns (A/B/C/D) blank
    const row = [
      '',                          // A: SSL FREE DAYS — WF1 fills
      '',                          // B: SSL — WF1 fills
      '',                          // C: VESSEL — WF1 fills
      '',                          // D: SIZE — WF1 fills
      order.containerNumber || '', // E: Container #
      order.masterBL || '',        // F: HOUSE BOL
      '',                          // G: Load #
      '',                          // H: REF #
      doDate,                      // I: Date DO RECEIVED
      order.arrivalDate || '',     // J: ETA
      deliveryLoc,                 // K: DELIVERY LOCATION
      order.portLocation || '',    // L: TERMINAL
    ]
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tab}'!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
    console.log(`[sheets] Load Board → appended to "${tab}" for ${order.containerNumber}`)
  }
}

// ---------------------------------------------------------------------------
// Upsert to Master Container List — always "Original" tab
//
// Column order:
// A: date slot ("3-17")  B: Container #  C: Truck Load  D: Custom Ref (BOL)
// E: PO Number  F: Pick up (terminal)  G: Size  H: Delivery Location
// I: Customer  J: Carrier  K: DO Sent to Carrier ("LT M-DD-YY")
// L: Rate Con  M: Truckmen  N: Consignee  O: ETA to Port / Rail
//
// WF-DO owns: A, B, D, H, I, K, N, O — E/G/J are WF1 / ops territory.
// If the container already exists: partial-update WF-DO columns only.
// If new: append a full row with WF1 columns left blank.
// ---------------------------------------------------------------------------
export async function appendToMasterList(order: WFDOOrder): Promise<void> {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = getMasterSheetId()

  const ltDate = order.sentAt ? `LT ${formatLTDate(order.sentAt)}` : ''

  const existingMap = await readColumnIndex(sheets, spreadsheetId, 'Original', 'B')
  const existingRow = existingMap.get(order.containerNumber)

  if (existingRow) {
    // Partial update — only touch WF-DO-owned columns, leave E/G/J (WF1) alone
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'Original'!A${existingRow}`, values: [[formatShortDate(order.arrivalDate)]] },
          { range: `'Original'!D${existingRow}`, values: [[order.masterBL || '']] },
          { range: `'Original'!F${existingRow}`, values: [[order.portLocation || '']] },
          { range: `'Original'!H${existingRow}`, values: [[order.consigneeAddress || '']] },
          { range: `'Original'!I${existingRow}`, values: [[order.consignee || '']] },
          { range: `'Original'!K${existingRow}`, values: [[ltDate]] },
          { range: `'Original'!N${existingRow}`, values: [[order.consignee || '']] },
          { range: `'Original'!O${existingRow}`, values: [[order.arrivalDate || '']] },
        ],
      },
    })
    console.log(`[sheets] Master List → updated row ${existingRow} in "Original" for ${order.containerNumber}`)
  } else {
    // New container — append full row; leave WF1 columns (E/G/J) blank
    const row = [
      formatShortDate(order.arrivalDate), // A: date slot
      order.containerNumber || '',         // B: Container #
      '',                                  // C: Truck Load — ops fills
      order.masterBL || '',                // D: Custom Ref (BOL)
      '',                                  // E: PO Number — WF1 fills
      order.portLocation || '',            // F: Pick up (terminal)
      '',                                  // G: Size — WF1 fills
      order.consigneeAddress || '',        // H: Delivery Location
      order.consignee || '',               // I: Customer
      '',                                  // J: Carrier (SSL) — WF1 fills
      ltDate,                              // K: DO Sent to Carrier
      '',                                  // L: Rate Con — ops fills
      '',                                  // M: Truckmen — ops fills
      order.consignee || '',               // N: Consignee
      order.arrivalDate || '',             // O: ETA to Port / Rail
    ]
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'Original'!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    })
    console.log(`[sheets] Master List → appended to "Original" for ${order.containerNumber}`)
  }
}

// ---------------------------------------------------------------------------
// WF1 row builders
// ---------------------------------------------------------------------------
function buildLoadBoardRow(container: WF1Container): string[] {
  return [
    container.freeDays != null ? String(container.freeDays) : '',  // A: SSL FREE DAYS
    container.sslLine || '',                                         // B: SSL
    '',                                                              // C: VESSEL
    container.size || '',                                            // D: SIZE
    container.containerNumber || '',                                 // E: Container #
    container.bl || '',                                              // F: HOUSE BOL
    '',                                                              // G: Load #
    container.po || '',                                              // H: REF #
    '',                                                              // I: Date DO RECEIVED
    container.eta || '',                                             // J: ETA
    container.destination || '',                                     // K: DELIVERY LOCATION
    container.terminal || '',                                        // L: TERMINAL
  ]
}

function buildMasterListRow(container: WF1Container): string[] {
  return [
    formatShortDate(container.eta),     // A: date slot ("3-17")
    container.containerNumber || '',    // B: Container #
    '',                                 // C: Truck Load
    container.bl || '',                 // D: Custom Ref (BOL)
    container.po || '',                 // E: PO Number
    container.terminal || '',           // F: Pick up (terminal)
    container.size || '',               // G: Size
    container.destination || '',        // H: Delivery Location
    '',                                 // I: Customer
    container.sslLine || '',            // J: Carrier (SSL line)
    '',                                 // K: DO Sent to Carrier
    '',                                 // L: Rate Con
    '',                                 // M: Truckmen
    '',                                 // N: Consignee
    container.eta || '',                // O: ETA to Port / Rail
  ]
}

// Read a single column from a sheet tab and return a map of value → 1-based row number.
async function readColumnIndex(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tab: string,
  col: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tab}'!${col}:${col}`,
    })
    const values = res.data.values ?? []
    for (let i = 0; i < values.length; i++) {
      const v = String(values[i]?.[0] ?? '').trim()
      if (v) map.set(v, i + 1)
    }
  } catch {
    // Tab may not exist yet — treat as empty
  }
  return map
}

// ---------------------------------------------------------------------------
// WF1 — Upsert containers to Load Board
// Batches all updates into one batchUpdate call per tab, all appends into
// one append call per tab — reduces 356 API calls to ~3 per tab.
// ---------------------------------------------------------------------------
export interface UpsertResult {
  written: number
  updated: number
  errors: string[]
  tabs: Record<string, { written: number; updated: number }>
}

export async function upsertWF1ContainersToLoadBoard(
  containers: WF1Container[],
): Promise<UpsertResult> {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = getLoadBoardSheetId()

  let written = 0, updated = 0
  const errors: string[] = []
  const tabs: Record<string, { written: number; updated: number }> = {}

  const byTab = new Map<string, WF1Container[]>()
  for (const c of containers) {
    const tab = resolveLoadBoardTab(c.destination)
    if (!byTab.has(tab)) byTab.set(tab, [])
    byTab.get(tab)!.push(c)
  }

  for (const [tab, tabContainers] of byTab) {
    const existingMap = await readColumnIndex(sheets, spreadsheetId, tab, 'E')

    const updateData: { range: string; values: string[][] }[] = []
    const newRows: string[][] = []
    let tabWritten = 0, tabUpdated = 0

    for (const container of tabContainers) {
      const row = buildLoadBoardRow(container)
      const existingRowNum = existingMap.get(container.containerNumber)
      if (existingRowNum) {
        updateData.push({ range: `'${tab}'!A${existingRowNum}:L${existingRowNum}`, values: [row] })
        tabUpdated++
      } else {
        newRows.push(row)
        tabWritten++
      }
    }

    try {
      if (updateData.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: { valueInputOption: 'USER_ENTERED', data: updateData },
        })
      }
      if (newRows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${tab}'!A:A`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: newRows },
        })
      }
    } catch (err) {
      errors.push(`Load Board "${tab}" batch failed: ${String(err)}`)
    }

    tabs[tab] = { written: tabWritten, updated: tabUpdated }
    written += tabWritten
    updated += tabUpdated
    console.log(`[sheets/wf1] Load Board "${tab}": ${tabWritten} added, ${tabUpdated} updated`)
  }

  return { written, updated, errors, tabs }
}

// ---------------------------------------------------------------------------
// WF1 — Upsert containers to Master Container List
// Same batching approach: one batchUpdate + one append per call.
// ---------------------------------------------------------------------------
export async function upsertWF1ContainersToMasterList(
  containers: WF1Container[],
): Promise<UpsertResult> {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = getMasterSheetId()

  let written = 0, updated = 0
  const errors: string[] = []

  const existingMap = await readColumnIndex(sheets, spreadsheetId, 'Original', 'B')

  const updateData: { range: string; values: string[][] }[] = []
  const newRows: string[][] = []

  for (const container of containers) {
    const row = buildMasterListRow(container)
    const existingRowNum = existingMap.get(container.containerNumber)
    if (existingRowNum) {
      updateData.push({ range: `'Original'!A${existingRowNum}:O${existingRowNum}`, values: [row] })
      updated++
    } else {
      newRows.push(row)
      written++
    }
  }

  try {
    if (updateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', data: updateData },
      })
    }
    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'Original'!A:A`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newRows },
      })
    }
  } catch (err) {
    errors.push(`Master List batch failed: ${String(err)}`)
  }

  console.log(`[sheets/wf1] Master List "Original": ${written} added, ${updated} updated`)
  return { written, updated, errors, tabs: { Original: { written, updated } } }
}
