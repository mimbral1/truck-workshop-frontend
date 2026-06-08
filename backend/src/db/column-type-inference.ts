import type { ResourceDefinition } from '../shared/types/domain.js'

const numberHints = [
  'amount',
  'atRiskHours',
  'cost',
  'costPerKm',
  'creditLimit',
  'creditUsed',
  'estimatedCost',
  'estimatedHours',
  'estimatedKm',
  'everyDays',
  'everyKm',
  'estimatedMinutes',
  'fuelLevel',
  'grossMargin',
  'hourlyRate',
  'km',
  'kmPerLiter',
  'kmRate',
  'kmUsed',
  'laborHours',
  'latitude',
  'liters',
  'loadCapacityKg',
  'longitude',
  'marginPercent',
  'marginPercentage',
  'monthlyCost',
  'netMargin',
  'odometer',
  'price',
  'pricePerLiter',
  'purchaseCost',
  'quantity',
  'rating',
  'rate',
  'revenue',
  'revenuePerKm',
  'score',
  'speed',
  'stock',
  'subtotal',
  'taxAmount',
  'targetHours',
  'total',
  'unitCost',
  'unitPrice',
  'volumeM3',
  'waitingHours',
  'weightKg',
  'percent',
]

const integerHints = [
  'activeCases',
  'averageDeliveryDays',
  'capacity',
  'deliveryTimeDays',
  'everyDays',
  'everyKm',
  'fuelLevel',
  'idleMinutes',
  'maxCases',
  'minStock',
  'odometer',
  'quantity',
  'score',
  'stock',
  'paymentTermsDays',
  'year',
]

export function inferColumnType(field: string, resource: ResourceDefinition): string {
  if (resource.jsonFields?.includes(field)) {
    return 'NVARCHAR(MAX)'
  }

  if (field.endsWith('At') || field.endsWith('Date') || field === 'date' || field === 'validUntil' || field === 'expiresAt') {
    return 'DATETIME2'
  }

  if (
    field.startsWith('is') ||
    field.startsWith('has') ||
    field.startsWith('requires') ||
    field.endsWith('Enabled') ||
    field.endsWith('Ok') ||
    field === 'active' ||
    field === 'newDamages' ||
    field === 'approvalRequired' ||
    field === 'safetyImpact' ||
    field === 'immobilized' ||
    field === 'outlookSaveToSentItems' ||
    field === 'sentByIntegration'
  ) {
    return 'BIT'
  }

  if (field.endsWith('Type')) {
    return 'NVARCHAR(255)'
  }

  if (field === 'unreadCount') {
    return 'INT'
  }

  if (integerHints.some((hint) => field.toLowerCase().includes(hint.toLowerCase()))) {
    return 'INT'
  }

  if (numberHints.some((hint) => field.toLowerCase().includes(hint.toLowerCase()))) {
    return 'DECIMAL(18, 4)'
  }

  if (field.endsWith('Id') || field === 'id') {
    return 'NVARCHAR(80)'
  }

  if (field.endsWith('Email')) {
    return 'NVARCHAR(180)'
  }

  if (field.endsWith('Number') || field.endsWith('Code') || field === 'code' || field === 'sku') {
    return 'NVARCHAR(80)'
  }

  if (
    field === 'description' ||
    field === 'notes' ||
    field === 'comment' ||
    field === 'failureDescription' ||
    field === 'closureSummary' ||
    field === 'observations' ||
    field === 'body' ||
    field === 'message' ||
    field === 'signature' ||
    field === 'lastMessagePreview' ||
    field === 'errorMessage'
  ) {
    return 'NVARCHAR(MAX)'
  }

  return 'NVARCHAR(255)'
}
