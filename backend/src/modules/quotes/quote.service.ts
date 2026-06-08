import { randomUUID } from 'node:crypto'
import {
  approvalResource,
  quoteResource,
  repairSolutionResource,
  workshopCaseResource,
} from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import { stripImmutableFields } from '../../shared/utils/payload-sanitizers.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'

const VALID_QUOTE_STATUSES = new Set(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'])
const VALID_LINE_TYPES = new Set(['part', 'labor', 'discount'])
const WORKSHOP_REPAIR_STATUSES = new Set(['new', 'diagnosis', 'solution', 'assigned'])

interface NormalizeOptions {
  actorName?: string
  currentQuote?: PlainRecord
  partial?: boolean
  quoteNumber?: string
  workshopCase: PlainRecord
}

interface NormalizedLineItem {
  description: string
  id: string
  quantity: number
  type: string
  unitPrice: number
}

export class QuoteService {
  private readonly approvals: ResourceRepositoryContract
  private readonly cases: ResourceRepositoryContract
  private readonly quotes: ResourceRepositoryContract
  private readonly repairSolutions: ResourceRepositoryContract

  constructor() {
    this.approvals = createRepository(approvalResource)
    this.cases = createRepository(workshopCaseResource)
    this.quotes = createRepository(quoteResource)
    this.repairSolutions = createRepository(repairSolutionResource)
  }

  async create(payload: PlainRecord, actorName: string) {
    const workshopCase = await this.requireCase(payload.caseId)
    const quoteNumber = await this.buildQuoteNumber(payload.quoteNumber)
    const normalized = await this.normalizeQuotePayload(payload, {
      actorName,
      quoteNumber,
      workshopCase,
    })
    const quote = await this.quotes.create(normalized)

    await this.applyStatusFlow(quote as PlainRecord, workshopCase, actorName)

    return quote
  }

  async update(id: string, payload: PlainRecord, actorName: string) {
    const currentQuote = await this.requireQuote(id)
    const workshopCase = await this.requireCase(payload.caseId || currentQuote.caseId)
    const normalized = await this.normalizeQuotePayload(stripImmutableFields(payload, ['customerId', 'quoteNumber', 'updatedAt']), {
      actorName,
      currentQuote,
      partial: true,
      workshopCase,
    })
    const quote = await this.quotes.update(id, normalized)

    await this.applyStatusFlow(quote as PlainRecord, workshopCase, actorName)

    return quote
  }

  async remove(id: string) {
    const quote = await this.requireQuote(id)

    if (quote.status !== 'DRAFT') {
      throw new AppError('Solo se pueden eliminar cotizaciones en borrador', 400)
    }

    return this.quotes.remove(id)
  }

  async requireQuote(id: string): Promise<PlainRecord> {
    const quote = await this.quotes.findById(id)

    if (!quote) {
      throw new AppError('Cotizacion no encontrada', 404)
    }

    return quote
  }

  async requireCase(caseId: unknown): Promise<PlainRecord> {
    const id = String(caseId || '').trim()

    if (!id) {
      throw new AppError('La cotizacion requiere un caso asociado', 400)
    }

    const workshopCase = await this.cases.findById(id)

    if (!workshopCase) {
      throw new AppError('Caso no encontrado para crear la cotizacion', 404)
    }

    return workshopCase
  }

  async normalizeQuotePayload(payload: PlainRecord, options: NormalizeOptions): Promise<PlainRecord> {
    const normalized: PlainRecord = { ...payload }

    if (!options.partial || payload.quoteNumber !== undefined || options.quoteNumber) {
      normalized.quoteNumber = options.quoteNumber || String(payload.quoteNumber || '').trim().toUpperCase()
    }

    if (!options.partial || payload.caseId !== undefined) {
      normalized.caseId = options.workshopCase.id
    }

    if (!options.partial || payload.caseNumber !== undefined) {
      normalized.caseNumber = String(payload.caseNumber || options.workshopCase.caseNumber || options.workshopCase.code || '').trim()
    }

    if (!options.partial || payload.customerName !== undefined) {
      normalized.customerName = String(payload.customerName || options.workshopCase.customerName || options.workshopCase.customer || '').trim()
    }

    if (!options.partial || payload.customerId !== undefined) {
      normalized.customerId = String(payload.customerId || options.workshopCase.customerId || '').trim()
    }

    if (!options.partial || payload.diagnosisSummary !== undefined) {
      normalized.diagnosisSummary = String(
        payload.diagnosisSummary ||
          options.currentQuote?.diagnosisSummary ||
          options.workshopCase.failureDescription ||
          options.workshopCase.title ||
          'Trabajo de taller cotizado',
      ).trim()
    }

    if (!options.partial || payload.status !== undefined) {
      normalized.status = normalizeStatus(payload.status || options.currentQuote?.status)
    }

    if (!options.partial || payload.items !== undefined) {
      normalized.items = await this.normalizeItems(payload.items, options)

      if (!options.partial && (normalized.items as NormalizedLineItem[]).length === 0) {
        throw new AppError('La cotizacion requiere al menos un item con valor', 400)
      }
    }

    if (!options.partial || payload.total !== undefined || payload.items !== undefined) {
      const items = (normalized.items as NormalizedLineItem[] | undefined) || (options.currentQuote?.items as NormalizedLineItem[] | undefined) || []
      normalized.total = calculateTotal(items)

      if (Number(payload.total || 0) > 0 && (!items || items.length === 0)) {
        normalized.total = Number(payload.total)
      }
    }

    if (!options.partial || payload.expiresAt !== undefined) {
      normalized.expiresAt = normalizeDate(payload.expiresAt || defaultExpiresAt())
    }

    if ((!options.partial || payload.approvedBy !== undefined) && normalizeStatus(normalized.status) === 'APPROVED') {
      normalized.approvedBy = String(payload.approvedBy || options.actorName || 'Sistema').trim()
    }

    return normalized
  }

  async normalizeItems(items: unknown, options: NormalizeOptions): Promise<NormalizedLineItem[]> {
    if (Array.isArray(items) && items.length > 0) {
      return items
        .map((item, index) => normalizeLineItem(item as PlainRecord, index))
        .filter((item) => item.description && item.quantity > 0 && item.unitPrice !== 0)
    }

    const fallbackTotal = Number(options.workshopCase.estimatedCost || 0)
    const latestSolution = await this.findLatestRepairSolution(options.workshopCase.id)
    const solutionTotal = Number(latestSolution?.estimatedCost || 0)
    const total = solutionTotal > 0 ? solutionTotal : fallbackTotal

    if (total <= 0) {
      return []
    }

    return [
      normalizeLineItem(
        {
          description: latestSolution?.summary || options.workshopCase.failureDescription || 'Servicio de taller',
          quantity: 1,
          type: 'labor',
          unitPrice: total,
        },
        0,
      ),
    ]
  }

  async findLatestRepairSolution(caseId: unknown): Promise<PlainRecord | undefined> {
    const result = await this.repairSolutions.findAll({
      caseId: caseId as string | number | undefined,
      limit: 1,
      order: 'desc',
      sort: 'updatedAt',
    })

    return result.data[0] as PlainRecord | undefined
  }

  async buildQuoteNumber(quoteNumber: unknown): Promise<string> {
    if (quoteNumber) {
      return String(quoteNumber).trim().toUpperCase()
    }

    const year = new Date().getFullYear()
    const result = await this.quotes.findAll({ limit: 100, order: 'desc', sort: 'createdAt' })
    const maxForYear = result.data.reduce((max, quote) => {
      const match = String((quote as PlainRecord).quoteNumber || '').match(/^COT-(\d{4})-(\d+)$/)

      if (!match || Number(match[1]) !== year) {
        return max
      }

      return Math.max(max, Number(match[2]))
    }, 0)

    return `COT-${year}-${String(maxForYear + 1).padStart(4, '0')}`
  }

  async applyStatusFlow(quote: PlainRecord, workshopCase: PlainRecord, actorName: string) {
    const status = normalizeStatus(quote.status)

    if (status === 'SENT') {
      await this.ensurePendingQuoteApproval(quote, actorName)
    }

    if (status === 'APPROVED') {
      await this.resolveQuoteApproval(quote, 'approved', actorName)
    }

    if (status === 'REJECTED') {
      await this.resolveQuoteApproval(quote, 'rejected', actorName)
    }

    await this.syncCaseWithQuote(quote, workshopCase)
  }

  async ensurePendingQuoteApproval(quote: PlainRecord, actorName: string) {
    const existing = await this.findQuoteApproval(quote)

    if (existing) {
      return this.approvals.update(existing.id as string, {
        amount: quote.total,
        status: 'pending',
      })
    }

    return this.approvals.create({
      amount: quote.total,
      approverRole: 'Cliente',
      caseId: quote.caseId,
      createdAt: new Date().toISOString(),
      relatedEntityId: quote.id,
      requestedBy: actorName || 'Sistema',
      status: 'pending',
      title: `Aprobar cotizacion ${quote.quoteNumber}`,
      type: 'quote',
    })
  }

  async resolveQuoteApproval(quote: PlainRecord, status: string, actorName: string) {
    const approval = await this.findQuoteApproval(quote)

    if (!approval) {
      return this.approvals.create({
        amount: quote.total,
        approverRole: 'Cliente',
        caseId: quote.caseId,
        createdAt: new Date().toISOString(),
        relatedEntityId: quote.id,
        requestedBy: actorName || 'Sistema',
        resolvedAt: new Date().toISOString(),
        status,
        title: `Aprobar cotizacion ${quote.quoteNumber}`,
        type: 'quote',
      })
    }

    return this.approvals.update(approval.id as string, {
      amount: quote.total,
      resolvedAt: new Date().toISOString(),
      status,
    })
  }

  async findQuoteApproval(quote: PlainRecord): Promise<PlainRecord | undefined> {
    const result = await this.approvals.findAll({
      caseId: quote.caseId as string | number | undefined,
      limit: 100,
      order: 'desc',
      sort: 'createdAt',
      type: 'quote',
    })

    return result.data.find((approval) => (approval as PlainRecord).relatedEntityId === quote.id) as PlainRecord | undefined
  }

  async syncCaseWithQuote(quote: PlainRecord, workshopCase: PlainRecord) {
    const patch: PlainRecord = {
      currentStep: currentStepForQuoteStatus(quote.status),
      estimatedCost: quote.total,
    }

    if (quote.status === 'APPROVED' && WORKSHOP_REPAIR_STATUSES.has(workshopCase.status as string)) {
      patch.status = 'repairing'
    }

    if (quote.status === 'REJECTED' && workshopCase.status === 'repairing') {
      patch.status = 'solution'
    }

    return this.cases.update(workshopCase.id as string, patch)
  }
}

function normalizeStatus(status: unknown): string {
  const normalized = String(status || 'DRAFT').trim().toUpperCase()

  return VALID_QUOTE_STATUSES.has(normalized) ? normalized : 'DRAFT'
}

function normalizeLineItem(item: PlainRecord, index: number): NormalizedLineItem {
  const type = VALID_LINE_TYPES.has(item.type as string) ? (item.type as string) : 'part'
  const quantity = Math.max(Number(item.quantity || 0), 0)
  const rawUnitPrice = Number(item.unitPrice || item.estimatedUnitCost || item.amount || 0)
  const unitPrice = type === 'discount' ? -Math.abs(rawUnitPrice) : Math.max(rawUnitPrice, 0)

  return {
    description: String(item.description || item.name || '').trim(),
    id: String(item.id || `ql-${randomUUID() || index + 1}`).trim(),
    quantity,
    type,
    unitPrice,
  }
}

function calculateTotal(items: NormalizedLineItem[]): number {
  return Math.max(
    items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0),
    0,
  )
}

function normalizeDate(value: unknown): string {
  const rawValue = String(value || '').trim()
  const date = rawValue.length === 10 ? new Date(`${rawValue}T18:00:00.000Z`) : new Date(rawValue)

  if (Number.isNaN(date.getTime())) {
    return defaultExpiresAt()
  }

  return date.toISOString()
}

function defaultExpiresAt(): string {
  const date = new Date()
  date.setDate(date.getDate() + 3)
  date.setUTCHours(18, 0, 0, 0)

  return date.toISOString()
}

function currentStepForQuoteStatus(status: unknown): string {
  const steps: Record<string, string> = {
    APPROVED: 'Cotizacion aprobada',
    DRAFT: 'Cotizacion en borrador',
    EXPIRED: 'Cotizacion expirada',
    REJECTED: 'Cotizacion rechazada',
    SENT: 'Cotizacion enviada',
  }

  return steps[normalizeStatus(status)]
}
