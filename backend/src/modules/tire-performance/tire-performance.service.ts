import {
  partResource,
  purchaseOrderResource,
  supplierResource,
  tireLifecycleResource,
  truckCostResource,
  truckResource,
} from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import type { PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'
import { stripImmutableFields } from '../../shared/utils/payload-sanitizers.js'

const VALID_TIRE_TYPES = new Set(['NEW', 'RETREADED'])
const VALID_USAGE_TYPES = new Set(['STEERING', 'TRACTION', 'TRAILER', 'SPARE'])
const VALID_POSITIONS = new Set([
  'FRONT_LEFT',
  'FRONT_RIGHT',
  'DRIVE_LEFT',
  'DRIVE_RIGHT',
  'DRIVE_INNER_LEFT',
  'DRIVE_INNER_RIGHT',
  'TRAILER_LEFT',
  'TRAILER_RIGHT',
  'SPARE',
])
const VALID_REMOVAL_REASONS = new Set([
  'NORMAL_WEAR',
  'PUNCTURE',
  'FAILURE',
  'RETREAD',
  'WARRANTY',
  'PREVENTIVE_CHANGE',
  'OPERATIONAL_DAMAGE',
  'UNKNOWN',
])
const INSTALLABLE_STATUSES = new Set(['PURCHASED', 'IN_STOCK'])
const CLOSED_STATUS_BY_REASON: Record<string, string> = {
  FAILURE: 'DISCARDED',
  NORMAL_WEAR: 'REMOVED',
  OPERATIONAL_DAMAGE: 'DISCARDED',
  PREVENTIVE_CHANGE: 'REMOVED',
  PUNCTURE: 'DISCARDED',
  RETREAD: 'RETREADED',
  UNKNOWN: 'DISCARDED',
  WARRANTY: 'WARRANTY_CLAIM',
}

interface EnsurePositionAvailableInput {
  tireId: unknown
  tirePosition: string
  truckId: string
}

export class TirePerformanceService {
  private readonly parts: ResourceRepositoryContract
  private readonly purchaseOrders: ResourceRepositoryContract
  private readonly suppliers: ResourceRepositoryContract
  private readonly tires: ResourceRepositoryContract
  private readonly trucks: ResourceRepositoryContract
  private readonly truckCosts: ResourceRepositoryContract

  constructor() {
    this.parts = createRepository(partResource)
    this.purchaseOrders = createRepository(purchaseOrderResource)
    this.suppliers = createRepository(supplierResource)
    this.tires = createRepository(tireLifecycleResource)
    this.trucks = createRepository(truckResource)
    this.truckCosts = createRepository(truckCostResource)
  }

  async create(payload: PlainRecord, actorName: string) {
    const normalized = await this.normalizeIntakePayload(payload, actorName)
    const tire = (await this.tires.create(normalized)) as PlainRecord

    await this.adjustPartStock(tire.skuId, 1, actorName)

    return tire
  }

  async intake(payload: PlainRecord, actorName: string) {
    const quantity = normalizeInteger(payload.quantity || 1, 'cantidad')

    if (quantity < 1 || quantity > 100) {
      throw new AppError('La cantidad debe estar entre 1 y 100 unidades', 400)
    }

    const basePayload = await this.normalizeIntakePayload(payload, actorName)
    const records: Array<PlainRecord | null> = []

    for (let index = 0; index < quantity; index += 1) {
      records.push(
        await this.tires.create({
          ...basePayload,
          notes: appendUnitNote(basePayload.notes, quantity, index),
        }),
      )
    }

    await this.adjustPartStock(basePayload.skuId, quantity, actorName)

    return records
  }

  async install(id: string, payload: PlainRecord, actorName: string) {
    const tire = await this.requireTire(id)

    if (!INSTALLABLE_STATUSES.has(tire.status as string)) {
      throw new AppError('Solo se pueden instalar neumaticos comprados o en stock', 400)
    }

    const truckId = String(payload.truckId || '').trim()
    const truck = await this.requireTruck(truckId)
    const odometerAtInstall = normalizeNumber(payload.odometerAtInstall, 'kilometraje inicial')
    const tirePosition = normalizePosition(payload.tirePosition || payload.position)
    const usageType = normalizeUsageType(payload.usageType || tire.usageType || 'TRACTION')
    const installedAt = normalizeDate(payload.installedAt || new Date().toISOString(), 'fecha de instalacion')

    await this.ensurePositionAvailable({
      tireId: tire.id,
      tirePosition,
      truckId,
    })

    const updated = await this.tires.update(id, {
      costPerKm: null,
      installedAt,
      kmUsed: null,
      notes: normalizeOptionalText(payload.notes, tire.notes),
      odometerAtInstall,
      odometerAtRemoval: null,
      removalReason: null,
      removedAt: null,
      status: 'INSTALLED',
      tirePosition,
      truckId,
      truckPlate: truck.plate,
      updatedBy: actorName,
      usageType,
    })

    await this.adjustPartStock(tire.skuId, -1, actorName)

    return updated
  }

  async remove(id: string, payload: PlainRecord, actorName: string) {
    const tire = await this.requireTire(id)

    if (tire.status !== 'INSTALLED') {
      throw new AppError('Solo se pueden retirar neumaticos que estan instalados en un camion', 400)
    }

    const odometerAtInstall = Number(tire.odometerAtInstall)

    if (!Number.isFinite(odometerAtInstall)) {
      throw new AppError('El neumatico no tiene kilometraje inicial registrado', 400)
    }

    const odometerAtRemoval = normalizeNumber(payload.odometerAtRemoval, 'kilometraje de retiro')

    if (odometerAtRemoval <= odometerAtInstall) {
      throw new AppError('El kilometraje de retiro debe ser mayor al kilometraje de instalacion', 400)
    }

    const removalReason = normalizeRemovalReason(payload.removalReason)
    const removedAt = normalizeDate(payload.removedAt || new Date().toISOString(), 'fecha de retiro')
    const kmUsed = odometerAtRemoval - odometerAtInstall
    const costPerKm = calculateCostPerKm(tire.purchaseCost, kmUsed)
    const status = CLOSED_STATUS_BY_REASON[removalReason]

    const updated = (await this.tires.update(id, {
      costPerKm,
      kmUsed,
      notes: normalizeOptionalText(payload.notes, tire.notes),
      odometerAtRemoval,
      removalReason,
      removedAt,
      status,
      updatedBy: actorName,
    })) as PlainRecord

    await this.createTireCostLedger(updated, actorName)

    return updated
  }

  async update(id: string, payload: PlainRecord, actorName: string) {
    const current = await this.requireTire(id)
    const normalized = normalizePatchPayload(payload, current, actorName)

    return this.tires.update(id, normalized)
  }

  async removeRecord(id: string, actorName: string) {
    await this.tires.update(id, { deletedBy: actorName, updatedBy: actorName })

    return this.tires.remove(id)
  }

  async normalizeIntakePayload(payload: PlainRecord, actorName: string): Promise<PlainRecord> {
    const skuId = String(payload.skuId || payload.partId || '').trim()
    const part = skuId ? await this.parts.findById(skuId) : null
    const supplierId = String(payload.supplierId || '').trim()
    const supplier = supplierId ? await this.suppliers.findById(supplierId) : null
    const purchaseOrderId = String(payload.purchaseOrderId || '').trim()
    const purchaseOrder = purchaseOrderId ? await this.purchaseOrders.findById(purchaseOrderId) : null
    const skuCode = normalizeRequiredText(payload.skuCode || part?.sku, 'SKU')
    const skuName = normalizeRequiredText(payload.skuName || part?.name, 'nombre de neumatico')
    const supplierName = normalizeRequiredText(payload.supplierName || supplier?.name || purchaseOrder?.supplierName, 'proveedor')
    const purchaseCost = normalizeNumber(payload.purchaseCost ?? part?.unitCost, 'costo de compra')

    if (purchaseCost <= 0) {
      throw new AppError('El costo de compra debe ser mayor a cero', 400)
    }

    return {
      brand: normalizeRequiredText(payload.brand, 'marca'),
      caseId: normalizeNullableText(payload.caseId),
      createdBy: payload.createdBy || actorName,
      model: normalizeNullableText(payload.model),
      notes: normalizeNullableText(payload.notes),
      purchaseCost,
      purchaseDate: normalizeDate(payload.purchaseDate || new Date().toISOString(), 'fecha de compra'),
      purchaseOrderId: purchaseOrder?.id || normalizeNullableText(payload.purchaseOrderId),
      skuCode,
      skuId: part?.id || skuId || skuCode,
      skuName,
      status: normalizeStockStatus(payload.status),
      supplierId: supplier?.id || normalizeNullableText(payload.supplierId),
      supplierName,
      tireSize: normalizeNullableText(payload.tireSize),
      tireType: normalizeTireType(payload.tireType),
      updatedBy: payload.updatedBy || actorName,
      usageType: normalizeUsageType(payload.usageType || inferUsageType(skuName)),
    }
  }

  async requireTire(id: string): Promise<PlainRecord> {
    const tire = await this.tires.findById(id)

    if (!tire) {
      throw new AppError('Neumatico no encontrado', 404)
    }

    return tire
  }

  async requireTruck(id: string): Promise<PlainRecord> {
    if (!id) {
      throw new AppError('Selecciona un camion para instalar el neumatico', 400)
    }

    const truck = await this.trucks.findById(id)

    if (!truck) {
      throw new AppError('Camion no encontrado para instalar neumatico', 404)
    }

    return truck
  }

  async ensurePositionAvailable({ tireId, tirePosition, truckId }: EnsurePositionAvailableInput) {
    const result = await this.tires.findAll({
      limit: 100,
      status: 'INSTALLED',
      tirePosition,
      truckId,
    })
    const conflict = (result.data as PlainRecord[]).find((item) => item.id !== tireId)

    if (conflict) {
      throw new AppError(`La posicion ya esta ocupada por ${String(conflict.skuCode)} en el camion ${String(conflict.truckPlate)}`, 409)
    }
  }

  async adjustPartStock(partId: unknown, delta: number, actorName: string) {
    if (!partId) {
      return
    }

    const part = await this.parts.findById(String(partId))

    if (!part) {
      return
    }

    await this.parts.update(String(partId), {
      stock: Math.max(0, Number(part.stock || 0) + delta),
      updatedBy: actorName,
    })
  }

  async createTireCostLedger(tire: PlainRecord, actorName: string) {
    if (!tire.truckId || !tire.purchaseCost || !tire.odometerAtRemoval) {
      return
    }

    await this.truckCosts.create({
      amount: Number(tire.purchaseCost),
      costType: 'TIRES',
      date: tire.removedAt || new Date().toISOString(),
      description: `Cierre rendimiento neumatico ${String(tire.skuCode)}`,
      notes: [
        `${Math.round(Number(tire.kmUsed || 0)).toLocaleString('es-CL')} km rendidos`,
        tire.costPerKm ? `$${Number(tire.costPerKm).toFixed(2)}/km` : '',
        tire.removalReason || '',
        `Registrado por ${actorName}`,
      ]
        .filter(Boolean)
        .join(' - '),
      odometer: Number(tire.odometerAtRemoval),
      relatedEntityId: tire.id,
      relatedEntityType: 'tire-performance',
      truckId: tire.truckId,
    })
  }
}

function normalizePatchPayload(payload: PlainRecord, current: PlainRecord, actorName: string): PlainRecord {
  const normalized = stripImmutableFields(payload, ['deletedBy'])

  if (payload.status !== undefined) {
    normalized.status = normalizeLifecycleStatus(payload.status)
  }

  if (payload.tireType !== undefined) {
    normalized.tireType = normalizeTireType(payload.tireType)
  }

  if (payload.usageType !== undefined) {
    normalized.usageType = normalizeUsageType(payload.usageType)
  }

  if (payload.tirePosition !== undefined && payload.tirePosition !== null && payload.tirePosition !== '') {
    normalized.tirePosition = normalizePosition(payload.tirePosition)
  }

  if (payload.removalReason !== undefined && payload.removalReason !== null && payload.removalReason !== '') {
    normalized.removalReason = normalizeRemovalReason(payload.removalReason)
  }

  const odometerAtInstall = normalized.odometerAtInstall ?? current.odometerAtInstall
  const odometerAtRemoval = normalized.odometerAtRemoval ?? current.odometerAtRemoval

  if (odometerAtInstall !== undefined && odometerAtRemoval !== undefined) {
    const kmUsed = Number(odometerAtRemoval) - Number(odometerAtInstall)

    if (kmUsed > 0) {
      normalized.kmUsed = kmUsed
      normalized.costPerKm = calculateCostPerKm(normalized.purchaseCost ?? current.purchaseCost, kmUsed)
    }
  }

  normalized.updatedBy = actorName

  return normalized
}

function normalizeTireType(value: unknown): string {
  const normalized = String(value || 'NEW').trim().toUpperCase()

  return VALID_TIRE_TYPES.has(normalized) ? normalized : 'NEW'
}

function normalizeUsageType(value: unknown): string {
  const normalized = String(value || 'TRACTION').trim().toUpperCase()

  if (!VALID_USAGE_TYPES.has(normalized)) {
    throw new AppError('Tipo de uso de neumatico invalido', 400)
  }

  return normalized
}

function normalizePosition(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase()

  if (!VALID_POSITIONS.has(normalized)) {
    throw new AppError('Posicion de neumatico invalida', 400)
  }

  return normalized
}

function normalizeRemovalReason(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase()

  if (!VALID_REMOVAL_REASONS.has(normalized)) {
    throw new AppError('Motivo de retiro invalido', 400)
  }

  return normalized
}

function normalizeLifecycleStatus(value: unknown): string {
  const normalized = String(value || 'IN_STOCK').trim().toUpperCase()
  const validStatuses = new Set(['PURCHASED', 'IN_STOCK', 'INSTALLED', 'REMOVED', 'RETREADED', 'DISCARDED', 'WARRANTY_CLAIM'])

  if (!validStatuses.has(normalized)) {
    throw new AppError('Estado de neumatico invalido', 400)
  }

  return normalized
}

function normalizeStockStatus(value: unknown): string {
  const normalized = String(value || 'IN_STOCK').trim().toUpperCase()

  return INSTALLABLE_STATUSES.has(normalized) ? normalized : 'IN_STOCK'
}

function normalizeNumber(value: unknown, label: string): number {
  const number = Number(value)

  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(`El valor de ${label} debe ser numerico y no negativo`, 400)
  }

  return number
}

function normalizeInteger(value: unknown, label: string): number {
  const number = normalizeNumber(value, label)

  if (!Number.isInteger(number)) {
    throw new AppError(`El valor de ${label} debe ser entero`, 400)
  }

  return number
}

function normalizeDate(value: unknown, label: string): string {
  const date = new Date(value as string)

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${label} invalida`, 400)
  }

  return date.toISOString()
}

function normalizeRequiredText(value: unknown, label: string): string {
  const text = String(value || '').trim()

  if (!text) {
    throw new AppError(`El campo ${label} es obligatorio`, 400)
  }

  return text
}

function normalizeNullableText(value: unknown): string | null {
  const text = String(value || '').trim()

  return text || null
}

function normalizeOptionalText(value: unknown, fallback: unknown): string | null {
  if (value === undefined) {
    return (fallback as string) || null
  }

  return normalizeNullableText(value)
}

function calculateCostPerKm(purchaseCost: unknown, kmUsed: number): number | null {
  if (!kmUsed || kmUsed <= 0) {
    return null
  }

  return Number((Number(purchaseCost || 0) / kmUsed).toFixed(4))
}

function inferUsageType(value: unknown): string {
  const normalized = String(value || '').toLowerCase()

  if (normalized.includes('direccion')) return 'STEERING'
  if (normalized.includes('arrastre')) return 'TRAILER'
  if (normalized.includes('repuesto')) return 'SPARE'
  return 'TRACTION'
}

function appendUnitNote(notes: unknown, quantity: number, index: number): string | null {
  if (quantity <= 1) {
    return (notes as string) || null
  }

  const suffix = `Unidad ${index + 1} de ${quantity}`

  return [notes, suffix].filter(Boolean).join(' - ')
}
