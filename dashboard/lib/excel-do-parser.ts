import * as XLSX from 'xlsx'
import { ParsedDO } from './claude'

// Parses the USF (United States Freight) delivery order xlsx format.
// Fixed layout: container# at row 10 col 0, consignee at row 18 col 4, etc.
export function parseUSFDeliveryOrderExcel(data: Buffer): ParsedDO {
  const wb = XLSX.read(data, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as string[][]

  const get = (r: number, c: number): string => String(rows[r]?.[c] ?? '').trim()

  const arrivalRaw = get(5, 4) || get(4, 4)
  const consigneeAddr = [get(19, 4), get(20, 4)].filter(Boolean).join(', ')
  const weightRaw = rows[10]?.[2]

  return {
    containerNumber: get(10, 0),
    masterBL: get(4, 0),
    arrivalDate: arrivalRaw,
    consignee: get(18, 4),
    consigneeAddress: consigneeAddr,
    cargoDescription: get(7, 2),
    packages: String(rows[4]?.[2] ?? ''),
    weightKg: weightRaw != null && weightRaw !== '' ? String(weightRaw) : '',
    weightLb: '',
    portLocation: '',
    sealNumber: get(13, 2),
    nvoName: get(1, 0),
    carrierEmail: '',
    packingListAttached: false,
    confidence: 'high',
  }
}
