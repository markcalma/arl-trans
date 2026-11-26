import * as XLSX from 'xlsx'
import { WF1Container } from './types'

// Convert an Excel date serial number to ISO date string (YYYY-MM-DD).
// Excel epoch is 1900-01-01 (with the infamous leap year bug adding 1 day).
function excelSerialToISO(serial: unknown): string {
  if (!serial || typeof serial !== 'number' || isNaN(serial)) return ''
  const msFromEpoch = (serial - 25569) * 86400 * 1000
  const d = new Date(msFromEpoch)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

function normalizeDate(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'number') return excelSerialToISO(value)
  const s = String(value).trim()
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toISOString().split('T')[0]
}

function str(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

// ---------------------------------------------------------------------------
// Excel (.xlsx / .xlsm) parser — handles two formats:
//
// Format A — AMERCARE per-location xlsx (EXTON / CARSEN / STOCKTON):
//   Row 1 header: Destination | ETA | FREE DAYS | Container | PO | AMERCARE BL | SSL BL | TERMINAL
//   Data from row 2. Detected by row[0][0] === 'Destination' and row[0][3] === 'Container'.
//
// Format B — ACR Truck Dispatch Report xlsm (from podium@oocllogistics.com):
//   Rows 1-4 metadata, row 5 header: Destination | ... | Container (col 6) | ... | Terminal (col 27)
//   Data from row 6. Detected by row[4][6] === 'Container'.
// ---------------------------------------------------------------------------
export function parseWaterReportExcel(buffer: Buffer): WF1Container[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  })

  if (rows.length === 0) return []

  const row0 = rows[0] as unknown[]
  const row4 = rows.length > 4 ? (rows[4] as unknown[]) : []

  // Detect format
  const isAmercareXlsx = str(row0[0]).toLowerCase() === 'destination' && str(row0[3]).toLowerCase() === 'container'
  const isAcrXlsm = str(row4[6]).toLowerCase() === 'container'

  if (isAmercareXlsx) {
    return parseAmercareXlsx(rows)
  } else if (isAcrXlsm) {
    return parseAcrXlsm(rows)
  }

  return []
}

function freeDaysNum(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return (!isNaN(n) && n > 0) ? n : null
}

// Format A: AMERCARE per-location xlsx
function parseAmercareXlsx(rows: unknown[][]): WF1Container[] {
  const containers: WF1Container[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.length === 0) continue
    const containerNumber = str(row[3]) // Col D
    if (!containerNumber || !/^[A-Z]{4}\d{7}$/.test(containerNumber)) continue
    containers.push({
      containerNumber,
      destination: str(row[0]),          // Col A
      eta: normalizeDate(row[1]),         // Col B
      freeDays: freeDaysNum(row[2]),      // Col C
      po: str(row[4]),                    // Col E
      bl: str(row[5]),                    // Col F: AMERCARE BL
      terminal: str(row[7]),              // Col H
      sslLine: '',
      size: '',
      sealNumber: '',
    })
  }
  return containers
}

// Format B: ACR Truck Dispatch Report xlsm
function parseAcrXlsm(rows: unknown[][]): WF1Container[] {
  const containers: WF1Container[] = []
  // Row 5 (index 4) = header; data from index 5
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.length === 0) continue
    const containerNumber = str(row[6]) // Col G
    if (!containerNumber || !/^[A-Z]{4}\d{7}$/.test(containerNumber)) continue
    containers.push({
      containerNumber,
      destination: str(row[0]),          // Col A
      eta: normalizeDate(row[1]),         // Col B: Revised Carrier FND ETA
      freeDays: freeDaysNum(row[3]),      // Col D: Number of Days Free Detention
      sealNumber: str(row[7]),            // Col H
      size: str(row[9]),                  // Col J: Size/Type
      bl: str(row[10]),                   // Col K
      po: str(row[11]),                   // Col L
      sslLine: str(row[23]),              // Col X: Carrier
      terminal: str(row[27]),             // Col AB: Terminal - PU Location
    })
  }
  return containers
}

// ---------------------------------------------------------------------------
// Team Three daily schedule email parser.
//
// Email body is plain text, NO attachment. Format per record (11 lines):
//   PO | Product Category | ETA Port | Container # | Seal # |
//   Delivery Date | Last Free Day | AvaiL | SSL | Days Out | Notes
// Some senders omit trailing blank fields, so we anchor on container # lines.
// All Team Three loads are 10 days free (Gary confirmed).
// Destination is derived from the email subject (Stockton or Exton).
// ---------------------------------------------------------------------------
export function parseTeamThreeSchedule(body: string, subject: string): WF1Container[] {
  const lines = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  const notesIdx = lines.findIndex((l) => l.trim() === 'Notes')
  if (notesIdx === -1) return []
  const dataLines = lines.slice(notesIdx + 1)

  const subjectUpper = subject.toUpperCase()
  const destination = subjectUpper.includes('EXTON') ? 'EXTON' : 'STOCKTON'

  // Find all container # positions (ISO 6346: 4 letters + 7 digits)
  const containerPositions: number[] = []
  for (let i = 0; i < dataLines.length; i++) {
    if (/^[A-Z]{4}\d{7}$/.test(dataLines[i].trim())) containerPositions.push(i)
  }

  const containers: WF1Container[] = []

  for (let ci = 0; ci < containerPositions.length; ci++) {
    const i = containerPositions[ci]
    const containerNum = dataLines[i].trim()
    const etaPort = i >= 1 ? dataLines[i - 1].trim() : ''
    const po = i >= 3 ? dataLines[i - 3].trim() : ''
    const sealNumber = i + 1 < dataLines.length ? dataLines[i + 1].trim() : ''

    // SSL: scan up to 6 lines after container # — first 2–5 uppercase-only word (carrier code)
    const nextContainerIdx = ci + 1 < containerPositions.length ? containerPositions[ci + 1] : dataLines.length
    let ssl = ''
    for (let j = i + 2; j < Math.min(i + 7, nextContainerIdx); j++) {
      const candidate = dataLines[j].trim()
      if (/^[A-Z]{2,5}$/.test(candidate) && candidate !== 'X') { ssl = candidate; break }
    }

    // Terminal: last non-empty, non-code line before the next container
    let terminal = ''
    for (let j = nextContainerIdx - 1; j > i + 1; j--) {
      const candidate = dataLines[j].trim()
      if (candidate && !/^[A-Z]{2,5}$/.test(candidate) && candidate !== 'X' &&
          !/^\d{1,3}$/.test(candidate) && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(candidate)) {
        terminal = candidate; break
      }
    }

    const eta = normalizeDate(etaPort)
    if (!eta) continue

    containers.push({ containerNumber: containerNum, destination, eta, freeDays: 10, sslLine: ssl, terminal, size: '', bl: '', po, sealNumber })
  }

  return containers
}

// ---------------------------------------------------------------------------
// Plain text / HTML email body parser (work order format from Mikki Corvey).
// Expected columns (11 per row after header):
// PO | Product Category | ETA Port | Container # | Seal # |
// Delivery Date | Last Free Day | AvaiL | SSL | Days Out | Notes
// Detects by a header row containing "PO" then "Product Category".
// ---------------------------------------------------------------------------
export function parseWaterReportText(emailBody: string): WF1Container[] {
  const lines = emailBody
    .replace(/<[^>]+>/g, ' ')    // strip HTML tags
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // Find header row
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const upper = lines[i].toUpperCase()
    if (upper.includes('CONTAINER') && upper.includes('ETA')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return []

  // Parse tab- or pipe-delimited lines after header
  const containers: WF1Container[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    const parts = line.split(/\t|\|/).map((p) => p.trim())
    if (parts.length < 4) continue

    // Try to find container number (4 letters + 7 digits) anywhere in the line
    const containerNumber = parts.find((p) => /^[A-Z]{4}\d{7}$/.test(p)) ?? ''
    if (!containerNumber) continue

    const containerIdx = parts.findIndex((p) => /^[A-Z]{4}\d{7}$/.test(p))

    containers.push({
      containerNumber,
      destination: 'Stockton, CA',   // work order format is always Stockton
      eta: normalizeDate(parts[containerIdx - 1] ?? ''),
      freeDays: null,
      sslLine: parts[containerIdx + 4] ?? '',
      terminal: '',
      size: '',
      bl: '',
      po: parts[0] ?? '',
      sealNumber: parts[containerIdx + 1] ?? '',
    })
  }

  return containers
}
