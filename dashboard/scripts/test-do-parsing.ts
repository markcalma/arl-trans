/**
 * Offline DO parsing test — calls Claude Vision and USF Excel parser directly on local files.
 * No DB writes, no Sheets writes, no email sending.
 *
 * Usage: npx tsx scripts/test-do-parsing.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load env BEFORE importing claude.ts — the Anthropic client is created at module load time
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

interface TestFile {
  label: string
  filePath: string
  type: 'pdf' | 'xlsx' | 'skip'
  skipReason?: string
  expectedContainers?: string[]
  notes?: string
}

const LORENE_DIR = 'C:\\Users\\28mar\\OneDrive\\Dev\\greg-clarke-arlv2\\materials\\lorene DOs and invoice samples - 11-13-2026\\DOs'
const GREG_DIR = 'C:\\Users\\28mar\\OneDrive\\Dev\\greg-clarke\\projects\\greg materials\\files 9-2-2026'

const TEST_FILES: TestFile[] = [
  // ── Lorene's samples (new formats) ──────────────────────────────────────────
  {
    label: 'OOCL multi-container (new B00021185)',
    filePath: path.join(LORENE_DIR, 'OOCL Logistics - Customs Delivery Order B00021185 337641,339375 - Merged.PDF'),
    type: 'pdf',
    expectedContainers: ['337641', '339375'],
    notes: 'OOCL multi-container — expect 2 DO records',
  },
  {
    label: 'WHSU6436066 — USF Excel DO',
    filePath: path.join(LORENE_DIR, 'WHSU6436066 230323703.xlsx'),
    type: 'xlsx',
    expectedContainers: ['WHSU6436066'],
  },
  {
    label: 'DH_479087_1_DO — DH format',
    filePath: path.join(LORENE_DIR, 'DH_479087_1_DO.pdf'),
    type: 'pdf',
  },
  {
    label: 'FCLHandover-MIO02 — FCL handover',
    filePath: path.join(LORENE_DIR, 'FCLHandover-MIO02-26011823-1.pdf'),
    type: 'pdf',
  },
  {
    label: 'FLEX-4093632 — FLEX format',
    filePath: path.join(LORENE_DIR, 'FLEX-4093632_DO_20261011T140021.pdf'),
    type: 'pdf',
  },
  {
    label: 'CSNU8080466 — standard',
    filePath: path.join(LORENE_DIR, 'CSNU8080466 339050.pdf'),
    type: 'pdf',
    expectedContainers: ['CSNU8080466'],
  },
  {
    label: 'DeliveryOrder_33416000001',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder_33416000001_639285329434814845.pdf'),
    type: 'pdf',
  },
  {
    label: 'DeliveryOrder_ST203157500001',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder_DeliveryOrderNoST203157500001_639269019579371184.pdf'),
    type: 'pdf',
  },
  {
    label: 'DeliveryOrder_639280932508693712',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder_DeliveryOrder_639280932508693712.pdf'),
    type: 'pdf',
  },
  {
    label: 'DeliveryOrder_IM261658000001',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder_IM261658000001_639277437441564603.pdf'),
    type: 'pdf',
  },
  {
    label: 'DeliveryOrder_IM261726200001',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder_IM261726200001_639277359139383180.pdf'),
    type: 'pdf',
  },
  {
    label: 'DeliveryOrder__639268151301614690',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder__639268151301614690.pdf'),
    type: 'pdf',
  },
  {
    label: 'DeliveryOrder__639283678071912550',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder__639283678071912550.pdf'),
    type: 'pdf',
  },
  {
    label: 'DeliveryOrder__IDF260508 HLXU1267312',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder__IDF260508 HLXU1267312.pdf'),
    type: 'pdf',
  },
  {
    label: 'DeliveryOrder___639267872112351930',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder___639267872112351930.pdf'),
    type: 'pdf',
  },
  {
    label: 'DeliveryOrder___639270670325707993',
    filePath: path.join(LORENE_DIR, 'DeliveryOrder___639270670325707993.pdf'),
    type: 'pdf',
  },
  {
    label: 'WAV2026-713~717 PL — packing list (should be skipped by filter)',
    filePath: path.join(LORENE_DIR, 'WAV2026-713~717 PL.pdf'),
    type: 'skip',
    skipReason: 'Filename contains " PL." — blocked by poller PAC/PL filter. Parsing anyway to confirm it is not a DO.',
  },
  {
    label: 'CSGU6635756+CSNU2574923 — already tested (multi-container baseline)',
    filePath: path.join(LORENE_DIR, 'CSGU6635756, CSNU2574923.pdf'),
    type: 'pdf',
    expectedContainers: ['CSGU6635756', 'CSNU2574923'],
    notes: 'Previously confirmed working — sanity check',
  },

  // ── greg-clarke files 9-2-2026 (additional DOs) ─────────────────────────────
  {
    label: 'ONEU5574796 — standard (baseline, session 11 ✅)',
    filePath: path.join(GREG_DIR, 'ONEU5574796 325663.pdf'),
    type: 'pdf',
    expectedContainers: ['ONEU5574796'],
  },
  {
    label: 'EISU8235064 — standard',
    filePath: path.join(GREG_DIR, 'EISU8235064 328933.pdf'),
    type: 'pdf',
    expectedContainers: ['EISU8235064'],
  },
  {
    label: 'EISU8538688 — standard',
    filePath: path.join(GREG_DIR, 'EISU8538688 332520.pdf'),
    type: 'pdf',
    expectedContainers: ['EISU8538688'],
  },
  {
    label: 'KKFU7921685 — standard',
    filePath: path.join(GREG_DIR, 'KKFU7921685 334516.pdf'),
    type: 'pdf',
    expectedContainers: ['KKFU7921685'],
  },
  {
    label: 'SEKU4408000 — standard',
    filePath: path.join(GREG_DIR, 'SEKU4408000 325664.pdf'),
    type: 'pdf',
    expectedContainers: ['SEKU4408000'],
  },
  {
    label: 'TCLU4875101 — standard',
    filePath: path.join(GREG_DIR, 'TCLU4875101 326358.pdf'),
    type: 'pdf',
    expectedContainers: ['TCLU4875101'],
  },
  {
    label: 'TCNU5632612 — standard',
    filePath: path.join(GREG_DIR, 'TCNU5632612 328925.pdf'),
    type: 'pdf',
    expectedContainers: ['TCNU5632612'],
  },
  {
    label: 'TGBU4489071 — standard',
    filePath: path.join(GREG_DIR, 'TGBU4489071 334514.pdf'),
    type: 'pdf',
    expectedContainers: ['TGBU4489071'],
  },
  {
    label: 'TGCU5576153 — standard',
    filePath: path.join(GREG_DIR, 'TGCU5576153 325666.pdf'),
    type: 'pdf',
    expectedContainers: ['TGCU5576153'],
  },
  {
    label: 'TIIU4680805 — standard',
    filePath: path.join(GREG_DIR, 'TIIU4680805 332355.pdf'),
    type: 'pdf',
    expectedContainers: ['TIIU4680805'],
  },
  {
    label: 'TRHU5441327 — standard',
    filePath: path.join(GREG_DIR, 'TRHU5441327 334515.pdf'),
    type: 'pdf',
    expectedContainers: ['TRHU5441327'],
  },
  {
    label: 'TRHU8376159 — standard',
    filePath: path.join(GREG_DIR, 'TRHU8376159 328938.pdf'),
    type: 'pdf',
    expectedContainers: ['TRHU8376159'],
  },
  {
    label: 'UETU4054373 — standard',
    filePath: path.join(GREG_DIR, 'UETU4054373 325680.pdf'),
    type: 'pdf',
    expectedContainers: ['UETU4054373'],
  },
  {
    label: 'WHSU5864141 — standard',
    filePath: path.join(GREG_DIR, 'WHSU5864141 325665.pdf'),
    type: 'pdf',
    expectedContainers: ['WHSU5864141'],
  },
  {
    label: 'DeliveryOrder_ST203096 — standard (greg-clarke)',
    filePath: path.join(GREG_DIR, 'DeliveryOrder_DeliveryOrderNoST203096000001_639220527575566596.pdf'),
    type: 'pdf',
  },
  {
    label: 'OOCL B00019988 329405 — single container',
    filePath: path.join(GREG_DIR, 'OOCL Logistics - Customs Delivery Order B00019988 329405 - Merged.PDF'),
    type: 'pdf',
    expectedContainers: ['329405'],
    notes: 'Single OOCL',
  },
  {
    label: 'OOCL B00019350 — 5 containers (session 12 ✅)',
    filePath: path.join(GREG_DIR, 'OOCL Logistics - Customs Delivery Order B00019350 324299,321604,328264,321602,328265 - Merged.PDF'),
    type: 'pdf',
    expectedContainers: ['EMCU8808369', 'GAOU7282735', 'TXGU5776680', 'EGSU9846470', 'CAAU5879967'],
    notes: 'Previously confirmed 5 DOs — sanity check',
  },
  {
    label: 'WHSU5554784 — USF Excel (session 12 ✅)',
    filePath: path.join(GREG_DIR, 'WHSU5554784 9343522I.xlsx'),
    type: 'xlsx',
    expectedContainers: ['WHSU5554784'],
    notes: 'Previously confirmed working',
  },
  {
    label: '9343522I PAC — packing list (should be rejected by filter)',
    filePath: path.join(GREG_DIR, '9343522I PAC.pdf'),
    type: 'skip',
    skipReason: 'Filename contains " PAC" — blocked by poller filter. Parsing anyway to confirm it is not a DO.',
  },
]

interface TestResult {
  label: string
  status: 'PASS' | 'WARN' | 'FAIL' | 'SKIP_CONFIRMED' | 'SKIP_WRONG' | 'ERROR' | 'NOT_FOUND'
  containers: string[]
  customer: string[]
  consignee: string[]
  arrivalDate: string[]
  portLocation: string[]
  confidence: string[]
  notes: string
  issues: string[]
}

function checkContainerFormat(c: string): boolean {
  // Standard ISO container format: 4 letters + 7 digits
  return /^[A-Z]{4}\d{7}$/.test(c)
}

type ParseAllDOs = (buf: Buffer) => Promise<import('../lib/claude').ParsedDO[]>
type ParseUSF = (buf: Buffer) => import('../lib/claude').ParsedDO

async function testFile(tf: TestFile, parseAllDOsFromPdf: ParseAllDOs, parseUSFDeliveryOrderExcel: ParseUSF): Promise<TestResult> {
  const issues: string[] = []

  if (!fs.existsSync(tf.filePath)) {
    return {
      label: tf.label,
      status: 'NOT_FOUND',
      containers: [], customer: [], consignee: [], arrivalDate: [], portLocation: [], confidence: [],
      notes: `File not found: ${tf.filePath}`,
      issues: ['File not found'],
    }
  }

  const data = fs.readFileSync(tf.filePath)

  if (tf.type === 'xlsx') {
    try {
      const parsed = parseUSFDeliveryOrderExcel(data)
      const containers = [parsed.containerNumber].filter(Boolean)
      if (!parsed.containerNumber) issues.push('container# missing')
      if (!parsed.consignee) issues.push('consignee missing')
      if (!parsed.arrivalDate) issues.push('arrivalDate missing')
      if (parsed.containerNumber && !checkContainerFormat(parsed.containerNumber)) {
        issues.push(`container# format unexpected: "${parsed.containerNumber}"`)
      }
      if (tf.expectedContainers) {
        for (const exp of tf.expectedContainers) {
          if (!containers.some(c => c.includes(exp))) {
            issues.push(`expected container "${exp}" not found`)
          }
        }
      }
      return {
        label: tf.label,
        status: issues.length === 0 ? 'PASS' : 'WARN',
        containers,
        customer: [parsed.customer || '(none)'],
        consignee: [parsed.consignee || ''],
        arrivalDate: [parsed.arrivalDate || ''],
        portLocation: [parsed.portLocation || ''],
        confidence: [parsed.confidence],
        notes: tf.notes || '',
        issues,
      }
    } catch (err) {
      return {
        label: tf.label,
        status: 'ERROR',
        containers: [], customer: [], consignee: [], arrivalDate: [], portLocation: [], confidence: [],
        notes: '',
        issues: [`Exception: ${err}`],
      }
    }
  }

  // PDF (including skip-flagged ones — we still parse to audit content)
  try {
    const parsedList = await parseAllDOsFromPdf(data)

    if (tf.type === 'skip') {
      // Confirm this file is correctly identified as NOT a real DO
      const hasRealDO = parsedList.some(p =>
        p.confidence !== 'low' && p.containerNumber && checkContainerFormat(p.containerNumber)
      )
      if (hasRealDO) {
        return {
          label: tf.label,
          status: 'SKIP_WRONG',
          containers: parsedList.map(p => p.containerNumber).filter(Boolean),
          customer: parsedList.map(p => p.customer || '(none)'),
          consignee: parsedList.map(p => p.consignee || ''),
          arrivalDate: parsedList.map(p => p.arrivalDate || ''),
          portLocation: parsedList.map(p => p.portLocation || ''),
          confidence: parsedList.map(p => p.confidence),
          notes: `${tf.skipReason} — WARNING: Claude found real DO fields! Poller filter alone may not be enough.`,
          issues: ['Packing list / PAC file parsed as a DO — filter review needed'],
        }
      }
      return {
        label: tf.label,
        status: 'SKIP_CONFIRMED',
        containers: parsedList.map(p => p.containerNumber).filter(Boolean),
        customer: [],
        consignee: [],
        arrivalDate: [],
        portLocation: [],
        confidence: parsedList.map(p => p.confidence),
        notes: tf.skipReason || '',
        issues: [],
      }
    }

    if (parsedList.length === 0) {
      return {
        label: tf.label,
        status: 'FAIL',
        containers: [], customer: [], consignee: [], arrivalDate: [], portLocation: [], confidence: [],
        notes: '',
        issues: ['Claude returned 0 DOs — would create needs_manual_review stub in production'],
      }
    }

    const containers = parsedList.map(p => p.containerNumber).filter(Boolean)
    const customers = parsedList.map(p => p.customer || '(none)')
    const consignees = parsedList.map(p => p.consignee || '')
    const arrivalDates = parsedList.map(p => p.arrivalDate || '')
    const portLocations = parsedList.map(p => p.portLocation || '')
    const confidences = parsedList.map(p => p.confidence)

    // Checks
    if (containers.length === 0) issues.push('no container numbers extracted')
    for (const c of containers) {
      if (!checkContainerFormat(c)) issues.push(`container# format unexpected: "${c}"`)
    }
    const lowConfCount = parsedList.filter(p => p.confidence === 'low').length
    if (lowConfCount > 0) issues.push(`${lowConfCount}/${parsedList.length} DO(s) have low confidence`)
    const missingDate = parsedList.filter(p => !p.arrivalDate).length
    if (missingDate > 0) issues.push(`${missingDate}/${parsedList.length} DO(s) missing arrivalDate`)
    const missingConsignee = parsedList.filter(p => !p.consignee).length
    if (missingConsignee > 0) issues.push(`${missingConsignee}/${parsedList.length} DO(s) missing consignee`)
    const missingCustomer = parsedList.filter(p => !p.customer).length
    if (missingCustomer > 0) issues.push(`${missingCustomer}/${parsedList.length} DO(s) missing customer abbreviation`)

    if (tf.expectedContainers) {
      for (const exp of tf.expectedContainers) {
        if (!containers.some(c => c.includes(exp))) {
          issues.push(`expected container "${exp}" not found in results`)
        }
      }
    }

    return {
      label: tf.label,
      status: issues.length === 0 ? 'PASS' : (issues.some(i => i.includes('0 DO') || i.includes('expected container')) ? 'FAIL' : 'WARN'),
      containers,
      customer: customers,
      consignee: consignees,
      arrivalDate: arrivalDates,
      portLocation: portLocations,
      confidence: confidences,
      notes: tf.notes || (parsedList[0]?.notes ?? ''),
      issues,
    }
  } catch (err) {
    return {
      label: tf.label,
      status: 'ERROR',
      containers: [], customer: [], consignee: [], arrivalDate: [], portLocation: [], confidence: [],
      notes: '',
      issues: [`Exception: ${err}`],
    }
  }
}

function statusIcon(s: TestResult['status']): string {
  switch (s) {
    case 'PASS': return '✅'
    case 'WARN': return '⚠️ '
    case 'FAIL': return '❌'
    case 'SKIP_CONFIRMED': return '🔇'
    case 'SKIP_WRONG': return '🚨'
    case 'ERROR': return '💥'
    case 'NOT_FOUND': return '📁'
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  ARL-Trans DO Parsing Audit')
  console.log(`  ${new Date().toISOString()}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set — check .env.local')
    process.exit(1)
  }

  // Dynamic imports AFTER dotenv.config() so the Anthropic client gets the API key
  const { parseAllDOsFromPdf } = await import('../lib/claude')
  const { parseUSFDeliveryOrderExcel } = await import('../lib/excel-do-parser')

  const results: TestResult[] = []

  for (const tf of TEST_FILES) {
    process.stdout.write(`  Testing: ${tf.label} ... `)
    const result = await testFile(tf, parseAllDOsFromPdf, parseUSFDeliveryOrderExcel)
    results.push(result)
    console.log(statusIcon(result.status))
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────────')
  console.log('  RESULTS')
  console.log('───────────────────────────────────────────────────────────────\n')

  for (const r of results) {
    const icon = statusIcon(r.status)
    console.log(`${icon} ${r.label}`)
    if (r.containers.length > 0) {
      console.log(`     Containers : ${r.containers.join(' | ')}`)
    }
    if (r.customer.length > 0 && r.customer.some(c => c !== '(none)')) {
      console.log(`     Customer   : ${r.customer.join(' | ')}`)
    }
    if (r.consignee.length > 0 && r.consignee.some(Boolean)) {
      console.log(`     Consignee  : ${r.consignee.join(' | ')}`)
    }
    if (r.arrivalDate.length > 0 && r.arrivalDate.some(Boolean)) {
      console.log(`     ETA        : ${r.arrivalDate.join(' | ')}`)
    }
    if (r.portLocation.length > 0 && r.portLocation.some(Boolean)) {
      console.log(`     Terminal   : ${r.portLocation.join(' | ')}`)
    }
    if (r.confidence.length > 0) {
      console.log(`     Confidence : ${r.confidence.join(' | ')}`)
    }
    if (r.notes) console.log(`     Notes      : ${r.notes}`)
    if (r.issues.length > 0) {
      for (const issue of r.issues) {
        console.log(`     ⚠  Issue    : ${issue}`)
      }
    }
    console.log()
  }

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = {
    pass: results.filter(r => r.status === 'PASS').length,
    warn: results.filter(r => r.status === 'WARN').length,
    fail: results.filter(r => r.status === 'FAIL').length,
    skip: results.filter(r => r.status === 'SKIP_CONFIRMED').length,
    skipWrong: results.filter(r => r.status === 'SKIP_WRONG').length,
    error: results.filter(r => r.status === 'ERROR').length,
    notFound: results.filter(r => r.status === 'NOT_FOUND').length,
  }

  console.log('───────────────────────────────────────────────────────────────')
  console.log(`  ✅  PASS           : ${counts.pass}`)
  console.log(`  ⚠️   WARN (fields)  : ${counts.warn}`)
  console.log(`  ❌  FAIL           : ${counts.fail}`)
  console.log(`  🔇  SKIP confirmed : ${counts.skip}`)
  console.log(`  🚨  SKIP WRONG     : ${counts.skipWrong}`)
  console.log(`  💥  ERROR          : ${counts.error}`)
  console.log(`  📁  NOT FOUND      : ${counts.notFound}`)
  console.log('═══════════════════════════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
