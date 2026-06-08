import { freightPricingSettingsResource } from '../../config/resources.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import type { ListQuery, PlainRecord, ResourceRepositoryContract } from '../../shared/types/domain.js'
import { fuelPriceService } from '../fuel-prices/fuel-price.service.js'
import { MapsService } from '../maps/maps.service.js'
import {
  DEFAULT_CARGO_SURCHARGES,
  DEFAULT_FREIGHT_PRICING_SETTINGS,
  type FreightPricingSettings,
} from './freight-pricing.defaults.js'

const mapsService = new MapsService()

interface NormalizedSettings extends FreightPricingSettings {
  cargoSurcharges: FreightPricingSettings['cargoSurcharges'] & Record<string, number>
  [key: string]: unknown
}

interface CalculationSettings extends NormalizedSettings {
  fallbackDieselPricePerLiter: number
  fuelPriceSource: PlainRecord
}

interface LineItem {
  id: string
  label: string
  quantity: number
  total: number
  unitAmount: number
}

interface BuildLineItemsArgs {
  cargoTypeSurcharge: number
  distanceCost: number
  fuelCost: number
  fuelLiters: number
  loadingCost: number
  marginAmount: number
  operationCost: number
  settings: CalculationSettings
  tollCharge: number
  tollCost: number
  unloadingCost: number
  waitingCost: number
  waitingHours: number
}

export class FreightPricingService {
  private readonly settings: ResourceRepositoryContract

  constructor() {
    this.settings = createRepository(freightPricingSettingsResource)
  }

  async getActiveSettings(): Promise<NormalizedSettings> {
    const result = await this.settings.findAll({
      active: true,
      limit: 10,
      order: 'desc',
      sort: 'updatedAt',
    } as unknown as ListQuery)
    const active = result.data[0]

    if (active) {
      return normalizeSettings(active)
    }

    const created = await this.settings.create({
      ...DEFAULT_FREIGHT_PRICING_SETTINGS,
      createdBy: 'Sistema',
      updatedBy: 'Sistema',
    })

    return normalizeSettings(created || {})
  }

  async updateActiveSettings(payload: PlainRecord, actorName = 'Sistema'): Promise<PlainRecord | null> {
    const current = await this.getActiveSettings()
    const nextSettings = normalizeSettings({
      ...current,
      ...payload,
      active: true,
      cargoSurcharges: {
        ...current.cargoSurcharges,
        ...((payload.cargoSurcharges as PlainRecord | undefined) || {}),
      },
      updatedBy: actorName,
    })

    return this.settings.update(String(current.id), nextSettings)
  }

  async calculate(payload: PlainRecord = {}): Promise<PlainRecord> {
    const settings = await this.getActiveSettings()
    const fuelPriceSource = (await fuelPriceService.getCurrentPrice({
      fuelType: 'DIESEL',
      regionCode: payload.fuelRegionCode as string | undefined,
    })) as unknown as PlainRecord
    const dieselPricePerLiter = Math.round(positiveNumber(fuelPriceSource.pricePerLiter) || settings.dieselPricePerLiter)
    const calculationSettings: CalculationSettings = {
      ...settings,
      dieselPricePerLiter,
      fallbackDieselPricePerLiter: settings.dieselPricePerLiter,
      fuelPriceSource,
    }
    const route = (await this.resolveRoute(payload)) as PlainRecord | null
    const tolls = route?.tolls as PlainRecord | undefined
    const estimatedKm = positiveNumber(route?.distanceKm ?? payload.estimatedKm)
    const waitingHours = positiveNumber(payload.waitingHours)
    const cargoType = String(payload.cargoType || 'GENERAL').toUpperCase()
    const tollCost = Math.round(positiveNumber(payload.tollCost ?? payload.manualTollCost ?? tolls?.totalAmount))
    const fuelLiters = estimatedKm > 0 ? round2(estimatedKm / calculationSettings.fuelKmPerLiter) : 0
    const fuelCost = Math.round(fuelLiters * dieselPricePerLiter)
    const operationCost = Math.round(estimatedKm * calculationSettings.operationCostPerKm)
    const distanceCost = fuelCost + operationCost
    const tollCharge = Math.round(tollCost * (1 + calculationSettings.tollMarkupPercent / 100))
    const waitingCost = Math.round(waitingHours * calculationSettings.waitingHourRate)
    const loadingCost = payload.requiresLoadingHelp ? calculationSettings.loadingHelpCost : 0
    const unloadingCost = payload.requiresUnloadingHelp ? calculationSettings.unloadingHelpCost : 0
    const cargoTypeSurcharge = Math.round(positiveNumber(calculationSettings.cargoSurcharges[cargoType]))
    const subtotalBeforeMargin =
      calculationSettings.baseRate +
      distanceCost +
      tollCharge +
      cargoTypeSurcharge +
      waitingCost +
      loadingCost +
      unloadingCost
    const marginAmount = Math.round(subtotalBeforeMargin * (calculationSettings.marginPercent / 100))
    const subtotal = subtotalBeforeMargin + marginAmount
    const taxAmount = Math.round(subtotal * (calculationSettings.taxPercent / 100))
    const total = subtotal + taxAmount
    const kmRate = estimatedKm > 0 ? Math.round(distanceCost / estimatedKm) : 0

    return {
      baseRate: calculationSettings.baseRate,
      cargoType,
      cargoTypeSurcharge,
      currencyCode: calculationSettings.currencyCode,
      dieselPricePerLiter,
      distanceCost,
      estimatedKm,
      fuelCost,
      fuelKmPerLiter: calculationSettings.fuelKmPerLiter,
      fuelLiters,
      fuelPriceSource,
      kmRate,
      lineItems: buildLineItems({
        cargoTypeSurcharge,
        distanceCost,
        fuelCost,
        fuelLiters,
        loadingCost,
        marginAmount,
        operationCost,
        settings: calculationSettings,
        tollCharge,
        tollCost,
        unloadingCost,
        waitingCost,
        waitingHours,
      }),
      loadingCost,
      marginAmount,
      operationCost,
      operationCostPerKm: calculationSettings.operationCostPerKm,
      pricingConfigId: calculationSettings.id,
      pricingSnapshot: calculationSettings,
      route,
      routePricingSnapshot: route
        ? {
            distanceKm: route.distanceKm,
            durationText: route.durationText,
            tolls: route.tolls,
          }
        : undefined,
      subtotal,
      taxAmount,
      tollCharge,
      tollCost,
      tolls: route?.tolls,
      total,
      unloadingCost,
      waitingCost,
    }
  }

  async resolveRoute(payload: PlainRecord): Promise<unknown> {
    const origin = payload.origin || payload.originAddress
    const destination = payload.destination || payload.destinationAddress

    if (!origin || !destination) {
      return payload.route || null
    }

    try {
      return await mapsService.route({
        destination,
        origin,
      })
    } catch {
      return payload.route || null
    }
  }
}

function normalizeSettings(value: PlainRecord = {}): NormalizedSettings {
  const merged = {
    ...DEFAULT_FREIGHT_PRICING_SETTINGS,
    ...value,
    cargoSurcharges: {
      ...DEFAULT_CARGO_SURCHARGES,
      ...((value.cargoSurcharges as PlainRecord | undefined) || {}),
    },
  } as NormalizedSettings

  return {
    ...merged,
    active: Boolean(merged.active),
    baseRate: Math.round(positiveNumber(merged.baseRate)),
    dieselPricePerLiter: Math.round(positiveNumber(merged.dieselPricePerLiter)),
    fuelKmPerLiter: Math.max(positiveNumber(merged.fuelKmPerLiter), 0.1),
    loadingHelpCost: Math.round(positiveNumber(merged.loadingHelpCost)),
    marginPercent: positiveNumber(merged.marginPercent),
    operationCostPerKm: Math.round(positiveNumber(merged.operationCostPerKm)),
    taxPercent: positiveNumber(merged.taxPercent),
    tollMarkupPercent: positiveNumber(merged.tollMarkupPercent),
    unloadingHelpCost: Math.round(positiveNumber(merged.unloadingHelpCost)),
    waitingHourRate: Math.round(positiveNumber(merged.waitingHourRate)),
  }
}

function buildLineItems({
  cargoTypeSurcharge,
  distanceCost,
  fuelCost,
  fuelLiters,
  loadingCost,
  marginAmount,
  operationCost,
  settings,
  tollCharge,
  tollCost,
  unloadingCost,
  waitingCost,
  waitingHours,
}: BuildLineItemsArgs): LineItem[] {
  const items: LineItem[] = [
    {
      id: 'base-rate',
      label: 'Tarifa base',
      quantity: 1,
      total: settings.baseRate,
      unitAmount: settings.baseRate,
    },
    {
      id: 'fuel',
      label: 'Petroleo estimado',
      quantity: fuelLiters,
      total: fuelCost,
      unitAmount: settings.dieselPricePerLiter,
    },
    {
      id: 'operation-km',
      label: 'Costo operacional por km',
      quantity: distanceCost > 0 ? Math.round((operationCost / Math.max(settings.operationCostPerKm, 1)) * 10) / 10 : 0,
      total: operationCost,
      unitAmount: settings.operationCostPerKm,
    },
  ]

  if (tollCharge > 0 || tollCost > 0) {
    items.push({
      id: 'tolls',
      label: 'Peajes ruta',
      quantity: 1,
      total: tollCharge,
      unitAmount: tollCost,
    })
  }

  if (cargoTypeSurcharge > 0) {
    items.push({
      id: 'cargo-surcharge',
      label: 'Recargo tipo de carga',
      quantity: 1,
      total: cargoTypeSurcharge,
      unitAmount: cargoTypeSurcharge,
    })
  }

  if (waitingCost > 0) {
    items.push({
      id: 'waiting',
      label: 'Horas de espera',
      quantity: waitingHours,
      total: waitingCost,
      unitAmount: settings.waitingHourRate,
    })
  }

  if (loadingCost > 0) {
    items.push({ id: 'loading', label: 'Ayuda de carga', quantity: 1, total: loadingCost, unitAmount: loadingCost })
  }

  if (unloadingCost > 0) {
    items.push({ id: 'unloading', label: 'Ayuda de descarga', quantity: 1, total: unloadingCost, unitAmount: unloadingCost })
  }

  if (marginAmount > 0) {
    items.push({ id: 'margin', label: 'Margen operacional', quantity: 1, total: marginAmount, unitAmount: marginAmount })
  }

  return items
}

function positiveNumber(value: unknown): number {
  const parsed = Number(value || 0)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
