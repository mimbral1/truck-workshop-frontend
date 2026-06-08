import { randomUUID } from 'node:crypto'
import { Router, type Request } from 'express'
import { resourceByName } from '../../config/resource-lookup.js'
import { createRepository } from '../../shared/data/repository-factory.js'
import { AppError } from '../../shared/errors/app-error.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { getActorName } from '../../shared/http/request-actor.js'
import { sendResponse } from '../../shared/http/send-response.js'
import type { PlainRecord } from '../../shared/types/domain.js'

const MASKED_SECRET = '********'

const repositories = {
  conversations: createRepository(resourceByName('communication-conversations')),
  messages: createRepository(resourceByName('communication-messages')),
  profiles: createRepository(resourceByName('communication-profiles')),
  providerConfigs: createRepository(resourceByName('communication-provider-configs')),
}

interface ProviderResult {
  errorMessage?: string
  fromAddress?: unknown
  mode?: string
  provider?: string
  providerMessageId?: unknown
  providerStatus?: string
  simulated?: boolean
}

interface DispatchArgs {
  body: string
  config: PlainRecord | undefined
  conversation: PlainRecord
  profile: PlainRecord
  subject: unknown
}

interface ProviderMessageArgs {
  body: string
  config: PlainRecord
  conversation: PlainRecord
  subject?: unknown
}

interface TestResult {
  mode: string
  ok: boolean
  provider: unknown
  status: string
}

interface InboundMessageArgs {
  config: PlainRecord | undefined
  inbound: PlainRecord
  profile: PlainRecord | undefined
  value: PlainRecord
}

interface FindOrCreateConversationArgs {
  channel: string
  contactAddress: string
  contactName: string
  profile: PlainRecord | undefined
}

export const communicationIntegrationRouter = Router()

communicationIntegrationRouter.get('/provider-configs', asyncHandler(async (request, response) => {
  const result = await repositories.providerConfigs.findAll({ ...request.query, limit: 100 })

  sendResponse(response, {
    ...result,
    data: result.data.map(maskProviderConfig),
  })
}))

communicationIntegrationRouter.get('/provider-configs/:id', asyncHandler(async (request, response) => {
  const config = await getProviderConfig(String(request.params.id))

  sendResponse(response, { data: maskProviderConfig(config) })
}))

communicationIntegrationRouter.post('/provider-configs', asyncHandler(async (request, response) => {
  const payload = normalizeProviderPayload(request.body, request)
  const config = await repositories.providerConfigs.create(payload)

  sendResponse(response, { data: maskProviderConfig(config as PlainRecord) }, 201)
}))

communicationIntegrationRouter.patch('/provider-configs/:id', asyncHandler(async (request, response) => {
  await getProviderConfig(String(request.params.id))
  const payload = normalizeProviderPayload(request.body, request, true)
  const config = await repositories.providerConfigs.update(String(request.params.id), payload)

  sendResponse(response, { data: maskProviderConfig(config as PlainRecord) })
}))

communicationIntegrationRouter.delete('/provider-configs/:id', asyncHandler(async (request, response) => {
  const config = await repositories.providerConfigs.remove(String(request.params.id))

  sendResponse(response, { data: maskProviderConfig(config) })
}))

communicationIntegrationRouter.post('/provider-configs/:id/test', asyncHandler(async (request, response) => {
  const config = await getProviderConfig(String(request.params.id))
  const testResult = await testProviderConfig(config)
  const savedConfig = await repositories.providerConfigs.update(String(config.id), {
    lastError: testResult.ok ? '' : testResult.status,
    lastTestAt: new Date().toISOString(),
    lastTestStatus: testResult.status,
    updatedBy: getActorName(request),
  })

  sendResponse(response, {
    data: {
      config: maskProviderConfig(savedConfig as PlainRecord),
      result: testResult,
    },
  })
}))

communicationIntegrationRouter.post('/send', asyncHandler(async (request, response) => {
  const result = await sendCommunicationMessage(request.body, request)

  sendResponse(response, { data: result }, 201)
}))

communicationIntegrationRouter.get('/webhooks/whatsapp', asyncHandler(async (request, response) => {
  const mode = request.query['hub.mode']
  const token = request.query['hub.verify_token']
  const challenge = request.query['hub.challenge']
  const configs = await repositories.providerConfigs.findAll({ channel: 'whatsapp', limit: 100 })
  const isValid = mode === 'subscribe' && configs.data.some((config) => config.whatsappWebhookVerifyToken && config.whatsappWebhookVerifyToken === token)

  if (!isValid) {
    response.sendStatus(403)
    return
  }

  response.status(200).send(String(challenge || ''))
}))

communicationIntegrationRouter.post('/webhooks/whatsapp', asyncHandler(async (request, response) => {
  await ingestWhatsAppWebhook(request.body)
  sendResponse(response, { data: { ok: true } })
}))

async function sendCommunicationMessage(payload: PlainRecord, request: Request): Promise<PlainRecord> {
  const conversation = await getConversation(payload.conversationId)
  const profile = await getProfile(payload.profileId || conversation.profileId)
  const config = await findProviderConfig(conversation.channel, profile.id)
  const sentAt = new Date().toISOString()
  const providerResult = await dispatchWithProvider({
    body: String(payload.body || '').trim(),
    config,
    conversation,
    profile,
    subject: payload.subject || conversation.subject,
  })
  const messageStatus = getMessageStatusFromProvider(providerResult)
  const message = await repositories.messages.create({
    attachments: payload.attachments || [],
    body: String(payload.body || '').trim(),
    channel: conversation.channel,
    conversationId: conversation.id,
    createdBy: payload.createdBy || getActorName(request),
    direction: 'outbound',
    errorMessage: providerResult.errorMessage,
    fromAddress: providerResult.fromAddress || config?.fromAddress || profile.address,
    fromName: profile.ownerName,
    profileId: profile.id,
    provider: providerResult.provider,
    providerConfigId: config?.id,
    providerMessageId: providerResult.providerMessageId,
    providerStatus: providerResult.providerStatus,
    sentAt,
    sentByIntegration: true,
    status: messageStatus,
    subject: conversation.channel === 'email' ? payload.subject || conversation.subject : undefined,
    toAddress: conversation.contactAddress,
    toName: conversation.contactName,
    updatedBy: payload.updatedBy || getActorName(request),
  }) as PlainRecord
  const updatedConversation = await repositories.conversations.update(String(conversation.id), {
    lastMessageAt: sentAt,
    lastMessagePreview: message.status === 'failed' ? `Error envio: ${message.body}` : message.body,
    status: 'open',
    unreadCount: 0,
    updatedBy: payload.updatedBy || getActorName(request),
  })

  return {
    conversation: updatedConversation,
    message,
    providerResult: {
      mode: providerResult.mode,
      provider: providerResult.provider,
      providerMessageId: providerResult.providerMessageId,
      providerStatus: providerResult.providerStatus,
      simulated: providerResult.simulated,
    },
  }
}

async function dispatchWithProvider({ body, config, conversation, profile, subject }: DispatchArgs): Promise<ProviderResult> {
  if (!body) {
    throw new AppError('El mensaje no puede estar vacio', 400)
  }

  if (!config || config.deliveryMode !== 'live' || !config.isActive) {
    return {
      fromAddress: profile.address,
      mode: 'simulation',
      provider: 'simulation',
      providerStatus: config ? 'simulation-mode' : 'missing-active-config',
      simulated: true,
    }
  }

  try {
    if (config.provider === 'whatsapp_cloud') {
      return await sendWhatsAppMessage({ body, config, conversation })
    }

    if (config.provider === 'microsoft_graph') {
      return await sendOutlookMessage({ body, config, conversation, subject })
    }

    throw new AppError('Proveedor de comunicacion no soportado', 400)
  } catch (error) {
    return {
      errorMessage: error instanceof Error ? error.message : 'No se pudo enviar el mensaje',
      fromAddress: config.fromAddress || profile.address,
      mode: 'live',
      provider: config.provider as string,
      providerStatus: 'failed',
    }
  }
}

async function sendWhatsAppMessage({ body, config, conversation }: ProviderMessageArgs): Promise<ProviderResult> {
  requireFields(config, ['whatsappPhoneNumberId', 'whatsappAccessToken'], 'WhatsApp')
  const apiVersion = config.whatsappApiVersion || 'v25.0'
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${config.whatsappPhoneNumberId}/messages`, {
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      text: {
        body,
        preview_url: true,
      },
      to: normalizePhone(conversation.contactAddress),
      type: 'text',
    }),
    headers: {
      Authorization: `Bearer ${config.whatsappAccessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const data = await safeJson(response)

  if (!response.ok) {
    throw new AppError(providerErrorMessage(data, 'WhatsApp rechazo el mensaje'), response.status)
  }

  return {
    fromAddress: config.fromAddress,
    mode: 'live',
    provider: 'whatsapp_cloud',
    providerMessageId: (data?.messages as Array<PlainRecord> | undefined)?.[0]?.id,
    providerStatus: 'accepted',
  }
}

async function sendOutlookMessage({ body, config, conversation, subject }: ProviderMessageArgs): Promise<ProviderResult> {
  requireFields(config, ['outlookTenantId', 'outlookClientId', 'outlookClientSecret', 'outlookUserPrincipalName'], 'Outlook')
  const token = await getOutlookAccessToken(config)
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(String(config.outlookUserPrincipalName))}/sendMail`,
    {
      body: JSON.stringify({
        message: {
          body: {
            content: body,
            contentType: 'Text',
          },
          subject: subject || conversation.subject || 'Mensaje operacional',
          toRecipients: [
            {
              emailAddress: {
                address: conversation.contactAddress,
                name: conversation.contactName,
              },
            },
          ],
        },
        saveToSentItems: config.outlookSaveToSentItems !== false,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )

  if (!response.ok) {
    const data = await safeJson(response)
    throw new AppError(providerErrorMessage(data, 'Microsoft Graph rechazo el correo'), response.status)
  }

  return {
    fromAddress: config.outlookUserPrincipalName || config.fromAddress,
    mode: 'live',
    provider: 'microsoft_graph',
    providerStatus: response.status === 202 ? 'accepted' : 'sent',
  }
}

async function getOutlookAccessToken(config: PlainRecord): Promise<string> {
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(String(config.outlookTenantId))}/oauth2/v2.0/token`, {
    body: new URLSearchParams({
      client_id: String(config.outlookClientId),
      client_secret: String(config.outlookClientSecret),
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })
  const data = await safeJson(response)

  if (!response.ok || !data?.access_token) {
    throw new AppError(providerErrorMessage(data, 'No se pudo obtener token de Microsoft Graph'), response.status)
  }

  return data.access_token as string
}

async function testProviderConfig(config: PlainRecord): Promise<TestResult> {
  if (config.deliveryMode !== 'live') {
    return {
      mode: 'simulation',
      ok: true,
      provider: config.provider,
      status: 'simulation-ready',
    }
  }

  if (config.provider === 'whatsapp_cloud') {
    requireFields(config, ['whatsappPhoneNumberId', 'whatsappAccessToken'], 'WhatsApp')
    const apiVersion = config.whatsappApiVersion || 'v25.0'
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${config.whatsappPhoneNumberId}?fields=display_phone_number,verified_name`, {
      headers: {
        Authorization: `Bearer ${config.whatsappAccessToken}`,
      },
    })
    const data = await safeJson(response)

    return {
      mode: 'live',
      ok: response.ok,
      provider: config.provider,
      status: response.ok ? `connected:${data?.display_phone_number || config.whatsappPhoneNumberId}` : providerErrorMessage(data, 'WhatsApp no conectado'),
    }
  }

  if (config.provider === 'microsoft_graph') {
    await getOutlookAccessToken(config)

    return {
      mode: 'live',
      ok: true,
      provider: config.provider,
      status: `connected:${config.outlookUserPrincipalName}`,
    }
  }

  return {
    mode: config.deliveryMode as string,
    ok: false,
    provider: config.provider,
    status: 'unsupported-provider',
  }
}

async function ingestWhatsAppWebhook(payload: PlainRecord): Promise<void> {
  const entries = Array.isArray(payload?.entry) ? payload.entry : []

  for (const entry of entries as PlainRecord[]) {
    for (const change of (entry.changes || []) as PlainRecord[]) {
      const value = (change.value || {}) as PlainRecord
      const phoneNumberId = (value.metadata as PlainRecord | undefined)?.phone_number_id

      await updateWhatsAppStatuses((value.statuses || []) as PlainRecord[])

      if (Array.isArray(value.messages) && value.messages.length > 0) {
        const config = phoneNumberId ? await findProviderConfigByPhoneNumberId(phoneNumberId) : undefined
        const profile = config?.profileId ? (await repositories.profiles.findById(String(config.profileId))) ?? undefined : undefined

        for (const inbound of value.messages as PlainRecord[]) {
          await createInboundWhatsAppMessage({ config, inbound, profile, value })
        }
      }
    }
  }
}

async function updateWhatsAppStatuses(statuses: PlainRecord[]): Promise<void> {
  for (const status of statuses) {
    if (!status?.id) {
      continue
    }

    const result = await repositories.messages.findAll({ limit: 1, providerMessageId: status.id as string })
    const message = result.data[0]

    if (!message) {
      continue
    }

    await repositories.messages.update(String(message.id), {
      deliveredAt: status.status === 'delivered' ? isoFromUnix(status.timestamp) : message.deliveredAt,
      providerStatus: status.status,
      readAt: status.status === 'read' ? isoFromUnix(status.timestamp) : message.readAt,
      status: mapWhatsAppStatus(status.status),
    })
  }
}

async function createInboundWhatsAppMessage({ config, inbound, profile, value }: InboundMessageArgs): Promise<void> {
  const contacts = value.contacts as PlainRecord[] | undefined
  const contact = contacts?.find((item) => item.wa_id === inbound.from) || contacts?.[0]
  const contactName = (contact?.profile as PlainRecord | undefined)?.name || inbound.from
  const contactAddress = `+${inbound.from}`
  const conversation = await findOrCreateInboundConversation({
    channel: 'whatsapp',
    contactAddress,
    contactName: String(contactName),
    profile,
  })
  const body = (inbound.text as PlainRecord | undefined)?.body
    || (inbound.button as PlainRecord | undefined)?.text
    || ((inbound.interactive as PlainRecord | undefined)?.button_reply as PlainRecord | undefined)?.title
    || '[Mensaje WhatsApp no textual]'

  await repositories.messages.create({
    attachments: [],
    body,
    channel: 'whatsapp',
    conversationId: conversation.id,
    createdBy: contactName,
    direction: 'inbound',
    fromAddress: contactAddress,
    fromName: contactName,
    profileId: profile?.id || config?.profileId || 'whatsapp-webhook',
    provider: 'whatsapp_cloud',
    providerConfigId: config?.id,
    providerMessageId: inbound.id,
    providerStatus: inbound.type || 'received',
    sentAt: isoFromUnix(inbound.timestamp),
    sentByIntegration: true,
    status: 'delivered',
    toAddress: profile?.address || config?.fromAddress || '',
    toName: profile?.ownerName || profile?.name || 'WhatsApp',
    updatedBy: 'Webhook WhatsApp',
  })

  await repositories.conversations.update(String(conversation.id), {
    lastMessageAt: isoFromUnix(inbound.timestamp),
    lastMessagePreview: body,
    status: 'open',
    unreadCount: Number(conversation.unreadCount || 0) + 1,
    updatedBy: 'Webhook WhatsApp',
  })
}

async function findOrCreateInboundConversation({ channel, contactAddress, contactName, profile }: FindOrCreateConversationArgs): Promise<PlainRecord> {
  const existing = await repositories.conversations.findAll({ channel, limit: 100 })
  const current = existing.data.find((conversation) => conversation.contactAddress === contactAddress)

  if (current) {
    return current
  }

  const now = new Date().toISOString()

  return repositories.conversations.create({
    assignedTo: profile?.ownerName || 'Mesa comunicaciones',
    channel,
    contactAddress,
    contactName,
    createdBy: 'Webhook WhatsApp',
    lastMessageAt: now,
    lastMessagePreview: 'Mensaje entrante recibido por webhook.',
    priority: 'medium',
    profileId: profile?.id || 'whatsapp-webhook',
    profileName: profile?.name || 'WhatsApp Cloud',
    relatedEntityType: 'general',
    status: 'open',
    subject: `WhatsApp ${contactName}`,
    tags: ['whatsapp', 'webhook'],
    unreadCount: 1,
    updatedBy: 'Webhook WhatsApp',
  }) as Promise<PlainRecord>
}

async function findProviderConfig(channel: unknown, profileId: unknown): Promise<PlainRecord | undefined> {
  const result = await repositories.providerConfigs.findAll({ channel: channel as string, limit: 100 })

  return result.data.find((config) => config.isActive && config.profileId === profileId)
    || result.data.find((config) => config.isActive)
}

async function findProviderConfigByPhoneNumberId(phoneNumberId: unknown): Promise<PlainRecord | undefined> {
  const result = await repositories.providerConfigs.findAll({ channel: 'whatsapp', limit: 100 })

  return result.data.find((config) => config.whatsappPhoneNumberId === phoneNumberId)
}

async function getConversation(id: unknown): Promise<PlainRecord> {
  const conversation = await repositories.conversations.findById(String(id))

  if (!conversation) {
    throw new AppError('Conversacion no encontrada', 404)
  }

  return conversation
}

async function getProfile(id: unknown): Promise<PlainRecord> {
  const profile = await repositories.profiles.findById(String(id))

  if (!profile) {
    throw new AppError('Perfil de comunicacion no encontrado', 404)
  }

  return profile
}

async function getProviderConfig(id: string): Promise<PlainRecord> {
  const config = await repositories.providerConfigs.findById(id)

  if (!config) {
    throw new AppError('Configuracion de integracion no encontrada', 404)
  }

  return config
}

function normalizeProviderPayload(payload: PlainRecord, request: Request, partial = false): PlainRecord {
  const cleanPayload: PlainRecord = { ...payload }
  const secretFields = ['whatsappAccessToken', 'whatsappAppSecret', 'outlookClientSecret']

  secretFields.forEach((field) => {
    if (cleanPayload[field] === MASKED_SECRET || cleanPayload[field] === '') {
      delete cleanPayload[field]
    }
  })

  if (!partial) {
    cleanPayload.id = cleanPayload.id || randomUUID()
    cleanPayload.deliveryMode = cleanPayload.deliveryMode || 'simulation'
    cleanPayload.isActive = cleanPayload.isActive ?? false
    cleanPayload.outlookSaveToSentItems = cleanPayload.outlookSaveToSentItems ?? true
    cleanPayload.whatsappApiVersion = cleanPayload.whatsappApiVersion || 'v25.0'
    cleanPayload.createdBy = cleanPayload.createdBy || getActorName(request)
  }

  cleanPayload.updatedBy = getActorName(request)

  return cleanPayload
}

function maskProviderConfig(config: PlainRecord): PlainRecord {
  return {
    ...config,
    hasOutlookClientSecret: Boolean(config.outlookClientSecret),
    hasWhatsappAccessToken: Boolean(config.whatsappAccessToken),
    hasWhatsappAppSecret: Boolean(config.whatsappAppSecret),
    outlookClientSecret: undefined,
    whatsappAccessToken: undefined,
    whatsappAppSecret: undefined,
  }
}

function getMessageStatusFromProvider(providerResult: ProviderResult): string {
  if (providerResult.providerStatus === 'failed') {
    return 'failed'
  }

  if (providerResult.simulated) {
    return 'queued'
  }

  if (providerResult.provider === 'whatsapp_cloud') {
    return 'sent'
  }

  return 'sent'
}

function requireFields(config: PlainRecord, fields: string[], label: string): void {
  const missing = fields.filter((field) => !config[field])

  if (missing.length > 0) {
    throw new AppError(`${label} requiere configurar: ${missing.join(', ')}`, 400)
  }
}

async function safeJson(response: Response): Promise<PlainRecord | null> {
  try {
    return (await response.json()) as PlainRecord
  } catch {
    return null
  }
}

function providerErrorMessage(data: PlainRecord | null, fallback: string): string {
  const error = data?.error as PlainRecord | undefined

  return String(error?.message || data?.error_description || data?.message || fallback)
}

function normalizePhone(value: unknown): string {
  return String(value || '').replace(/[^\d]/g, '')
}

function mapWhatsAppStatus(status: unknown): string {
  if (status === 'read') {
    return 'read'
  }

  if (status === 'delivered') {
    return 'delivered'
  }

  if (status === 'failed') {
    return 'failed'
  }

  return 'sent'
}

function isoFromUnix(value: unknown): string {
  const timestamp = Number(value)

  if (!Number.isFinite(timestamp)) {
    return new Date().toISOString()
  }

  return new Date(timestamp * 1000).toISOString()
}
