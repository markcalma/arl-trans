import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...(process.env.ANTHROPIC_WORKSPACE_ID && {
    defaultHeaders: { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID },
  }),
})

export interface ParsedDO {
  containerNumber: string
  masterBL: string
  arrivalDate: string
  consignee: string
  consigneeAddress: string
  cargoDescription: string
  packages: string
  weightKg: string
  weightLb: string
  portLocation: string
  sealNumber: string
  nvoName: string
  carrierEmail: string
  packingListAttached: boolean
  confidence: 'high' | 'medium' | 'low'
  notes?: string
}

const SYSTEM_PROMPT = `You are a logistics document parser. Extract structured data from delivery order (DO) documents.
Return ONLY valid JSON matching the requested schema. If a field is not found, return an empty string for that field.`

const EXTRACT_PROMPT = `Extract the following fields from this delivery order document and return as JSON:

{
  "containerNumber": "container number (e.g. MSCU1234567)",
  "masterBL": "master bill of lading number",
  "arrivalDate": "arrival/ETA date in MM/DD/YYYY format",
  "consignee": "consignee company name",
  "consigneeAddress": "consignee full address",
  "cargoDescription": "description of cargo/goods",
  "packages": "number and type of packages (e.g. '24 CARTONS')",
  "weightKg": "gross weight in KG",
  "weightLb": "gross weight in LB",
  "portLocation": "port of discharge or destination",
  "sealNumber": "seal number",
  "nvoName": "NVO or issuing agent name",
  "carrierEmail": "carrier contact email if present, otherwise empty string",
  "packingListAttached": true or false based on whether a packing list is mentioned,
  "confidence": "high" if most fields found, "medium" if some missing, "low" if very few fields found,
  "notes": "any important notes or warnings about the document"
}

Return only the JSON object, no markdown, no explanation.`

export async function parseDOFromPdf(pdfBytes: Buffer): Promise<ParsedDO> {
  const base64 = pdfBytes.toString('base64')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          { type: 'text', text: EXTRACT_PROMPT },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return parseJsonResponse(text)
}

export async function parseDOFromText(text: string): Promise<ParsedDO> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `${EXTRACT_PROMPT}\n\nDocument text:\n\n${text}`,
      },
    ],
  })

  const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
  return parseJsonResponse(responseText)
}

export async function classifyEmailAsDO(subject: string, body: string): Promise<boolean> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 5,
    messages: [
      {
        role: 'user',
        content: `Does this email contain or reference a delivery order (DO), freight release, or shipping document? Reply only "yes" or "no".\n\nSubject: ${subject}\n\nBody: ${body.slice(0, 800)}`,
      },
    ],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text.toLowerCase().trim() : 'no'
  return text.startsWith('yes')
}

export async function classifyEmailAsWaterReport(subject: string, body: string): Promise<boolean> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 5,
    messages: [
      {
        role: 'user',
        content: `Is this email a shipping/logistics water report or truck dispatch report (e.g. from Amercare, an ACR Truck Dispatch Report, or similar container arrival schedule)? Reply only "yes" or "no".\n\nSubject: ${subject}\n\nBody: ${body.slice(0, 800)}`,
      },
    ],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text.toLowerCase().trim() : 'no'
  return text.startsWith('yes')
}

function parseJsonResponse(text: string): ParsedDO {
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      containerNumber: parsed.containerNumber ?? '',
      masterBL: parsed.masterBL ?? '',
      arrivalDate: parsed.arrivalDate ?? '',
      consignee: parsed.consignee ?? '',
      consigneeAddress: parsed.consigneeAddress ?? '',
      cargoDescription: parsed.cargoDescription ?? '',
      packages: parsed.packages ?? '',
      weightKg: parsed.weightKg ?? '',
      weightLb: parsed.weightLb ?? '',
      portLocation: parsed.portLocation ?? '',
      sealNumber: parsed.sealNumber ?? '',
      nvoName: parsed.nvoName ?? '',
      carrierEmail: parsed.carrierEmail ?? '',
      packingListAttached: Boolean(parsed.packingListAttached),
      confidence: parsed.confidence ?? 'low',
      notes: parsed.notes,
    }
  } catch {
    return {
      containerNumber: '', masterBL: '', arrivalDate: '', consignee: '',
      consigneeAddress: '', cargoDescription: '', packages: '',
      weightKg: '', weightLb: '', portLocation: '', sealNumber: '',
      nvoName: '', carrierEmail: '', packingListAttached: false,
      confidence: 'low', notes: 'Failed to parse response from Claude',
    }
  }
}
