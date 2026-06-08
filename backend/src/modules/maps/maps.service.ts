import { env } from '../../config/env.js'
import { AppError } from '../../shared/errors/app-error.js'

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places'
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'
const STATIC_MAPS_URL = 'https://maps.googleapis.com/maps/api/staticmap'

const AUTOCOMPLETE_FIELD_MASK =
  'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'
const PLACE_DETAILS_FIELD_MASK = 'id,displayName,formattedAddress,postalAddress,location,addressComponents'
const ROUTE_FIELD_MASK =
  'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.travelAdvisory.tollInfo,routes.viewport,routes.legs.distanceMeters,routes.legs.duration,routes.legs.startLocation,routes.legs.endLocation'

const CACHE_TTL_MS = 1000 * 60 * 10
const AVERAGE_TRUCK_SPEED_KMH = 65
const ROAD_FACTOR_FALLBACK = 1.25

interface CacheEntry {
  expiresAt: number
  value: unknown
}

const cache = new Map<string, CacheEntry>()

interface Location {
  lat: number
  lng: number
}

interface PlaceDetails {
  city: string
  country: string
  formattedAddress: string
  location?: Location
  name?: string
  placeId?: string
  postalCode: string
  region: string
}

interface KnownChilePlace {
  city: string
  country: string
  formattedAddress: string
  location: Location
  name: string
  region: string
  terms: string[]
}

interface ParsedOpenPlace {
  osmId: string
  osmType: string
  details: PlaceDetails
}

type AnyRecord = Record<string, unknown>

const KNOWN_CHILE_PLACES: KnownChilePlace[] = [
  {
    city: 'Santiago',
    country: 'CL',
    formattedAddress: 'Santiago, Region Metropolitana, Chile',
    location: { lat: -33.4489, lng: -70.6693 },
    name: 'Santiago',
    region: 'Region Metropolitana',
    terms: ['santiago', 'region metropolitana', 'rm'],
  },
  {
    city: 'Valparaiso',
    country: 'CL',
    formattedAddress: 'Valparaiso, Region de Valparaiso, Chile',
    location: { lat: -33.0472, lng: -71.6127 },
    name: 'Valparaiso',
    region: 'Valparaiso',
    terms: ['valparaiso', 'valpo'],
  },
  {
    city: 'San Antonio',
    country: 'CL',
    formattedAddress: 'San Antonio, Region de Valparaiso, Chile',
    location: { lat: -33.5932, lng: -71.6217 },
    name: 'San Antonio',
    region: 'Valparaiso',
    terms: ['san antonio', 'puerto san antonio'],
  },
  {
    city: 'Quilicura',
    country: 'CL',
    formattedAddress: 'Quilicura, Region Metropolitana, Chile',
    location: { lat: -33.3667, lng: -70.7333 },
    name: 'Quilicura',
    region: 'Region Metropolitana',
    terms: ['quilicura'],
  },
  {
    city: 'San Bernardo',
    country: 'CL',
    formattedAddress: 'San Bernardo, Region Metropolitana, Chile',
    location: { lat: -33.5922, lng: -70.6996 },
    name: 'San Bernardo',
    region: 'Region Metropolitana',
    terms: ['san bernardo'],
  },
  {
    city: 'Rancagua',
    country: 'CL',
    formattedAddress: 'Rancagua, Region de O Higgins, Chile',
    location: { lat: -34.1708, lng: -70.7444 },
    name: 'Rancagua',
    region: 'O Higgins',
    terms: ['rancagua'],
  },
  {
    city: 'Los Andes',
    country: 'CL',
    formattedAddress: 'Los Andes, Region de Valparaiso, Chile',
    location: { lat: -32.8337, lng: -70.5983 },
    name: 'Los Andes',
    region: 'Valparaiso',
    terms: ['los andes'],
  },
  {
    city: 'Concepcion',
    country: 'CL',
    formattedAddress: 'Concepcion, Region del Biobio, Chile',
    location: { lat: -36.8201, lng: -73.0444 },
    name: 'Concepcion',
    region: 'Biobio',
    terms: ['concepcion', 'biobio'],
  },
  {
    city: 'La Serena',
    country: 'CL',
    formattedAddress: 'La Serena, Region de Coquimbo, Chile',
    location: { lat: -29.9027, lng: -71.2519 },
    name: 'La Serena',
    region: 'Coquimbo',
    terms: ['la serena', 'coquimbo'],
  },
]

export class MapsService {
  async autocomplete(query: unknown, sessionToken: unknown) {
    const normalizedQuery = String(query || '').trim()

    if (normalizedQuery.length < 3) {
      return []
    }

    const cacheKey = `autocomplete:${hasGoogleMapsKey() ? 'google-open' : 'open'}:${normalizedQuery.toLowerCase()}:${sessionToken || ''}`
    const cached = getCached(cacheKey)

    if (cached) {
      return cached
    }

    if (hasGoogleMapsKey()) {
      try {
        const suggestions = await autocompleteWithGoogle(normalizedQuery, sessionToken)
        setCached(cacheKey, suggestions)

        return suggestions
      } catch {
        // Public OpenStreetMap/Nominatim keeps the application usable when Google is not configured,
        // has quota issues, or rejects the current request.
      }
    }

    const suggestions = await autocompleteWithOpenMaps(normalizedQuery)
    setCached(cacheKey, suggestions)

    return suggestions
  }

  async placeDetails(placeId: unknown): Promise<PlaceDetails> {
    const normalizedPlaceId = normalizePlaceId(placeId)

    if (!normalizedPlaceId) {
      throw new AppError('El identificador de direccion es obligatorio.', 400)
    }

    const cacheKey = `place:${normalizedPlaceId}`
    const cached = getCached(cacheKey)

    if (cached) {
      return cached as PlaceDetails
    }

    if (isOpenPlaceId(normalizedPlaceId)) {
      const details = await placeDetailsWithOpenMaps(normalizedPlaceId)
      setCached(cacheKey, details)

      return details
    }

    let googleError: unknown

    if (hasGoogleMapsKey()) {
      try {
        const details = await placeDetailsWithGoogle(normalizedPlaceId)
        setCached(cacheKey, details)

        return details
      } catch (error) {
        googleError = error
      }
    }

    throw googleError || new AppError('No se pudo resolver esa direccion. Busca por texto para usar OpenStreetMap.', 404)
  }

  async route(payload: AnyRecord) {
    const originInput = payload?.origin
    const destinationInput = payload?.destination

    if (!hasWaypointInput(originInput) || !hasWaypointInput(destinationInput)) {
      throw new AppError('Origen y destino son obligatorios para calcular la ruta.', 400)
    }

    const hasOpenInput = inputHasOpenPlaceId(originInput) || inputHasOpenPlaceId(destinationInput)
    const cacheKey = `route:${hasGoogleMapsKey() && !hasOpenInput ? 'google-open' : 'open'}:${JSON.stringify(originInput)}:${JSON.stringify(destinationInput)}`
    const cached = getCached(cacheKey)

    if (cached) {
      return cached
    }

    if (hasGoogleMapsKey() && !hasOpenInput) {
      try {
        const googleRoute = await routeWithGoogle(payload)
        setCached(cacheKey, googleRoute)

        return googleRoute
      } catch {
        // If Google is unavailable, keep the operation alive with OSRM/OpenStreetMap.
      }
    }

    const openRoute = await routeWithOpenMaps(payload)
    setCached(cacheKey, openRoute)

    return openRoute
  }

  async staticRoute(query: AnyRecord) {
    const polyline = String(query?.polyline || '').trim()
    const originLat = Number(query?.originLat)
    const originLng = Number(query?.originLng)
    const destinationLat = Number(query?.destinationLat)
    const destinationLng = Number(query?.destinationLng)

    if (!polyline || !Number.isFinite(originLat) || !Number.isFinite(originLng) || !Number.isFinite(destinationLat) || !Number.isFinite(destinationLng)) {
      throw new AppError('La ruta estatica necesita polyline y coordenadas validas.', 400)
    }

    requireGoogleMapsKey()

    const params = new URLSearchParams({
      key: env.googleMaps.apiKey,
      language: env.googleMaps.language,
      maptype: 'roadmap',
      region: env.googleMaps.country,
      scale: '2',
      size: '900x420',
    })

    params.append('markers', `color:0x0f766e|label:O|${originLat},${originLng}`)
    params.append('markers', `color:0x0284c7|label:D|${destinationLat},${destinationLng}`)
    params.append('path', `color:0x0f766eff|weight:5|enc:${polyline}`)

    const response = await fetch(`${STATIC_MAPS_URL}?${params.toString()}`)

    if (!response.ok) {
      throw new AppError('No se pudo generar el mapa estatico de Google Maps.', 502, {
        status: response.status,
      })
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    return {
      buffer,
      contentType: response.headers.get('content-type') || 'image/png',
    }
  }
}

async function autocompleteWithGoogle(normalizedQuery: string, sessionToken: unknown) {
  const data = (await fetchGoogleJson(
    PLACES_AUTOCOMPLETE_URL,
    {
      includedRegionCodes: [env.googleMaps.country],
      input: normalizedQuery,
      languageCode: env.googleMaps.language,
      sessionToken: sessionToken || undefined,
    },
    {
      fieldMask: AUTOCOMPLETE_FIELD_MASK,
    },
  )) as AnyRecord

  return ((data.suggestions as AnyRecord[]) || [])
    .map((item) => item.placePrediction as AnyRecord | undefined)
    .filter((prediction): prediction is AnyRecord => Boolean(prediction))
    .map((prediction) => ({
      description: (prediction.text as AnyRecord | undefined)?.text || '',
      mainText:
        ((prediction.structuredFormat as AnyRecord | undefined)?.mainText as AnyRecord | undefined)?.text ||
        (prediction.text as AnyRecord | undefined)?.text ||
        '',
      placeId: prediction.placeId,
      provider: 'google',
      secondaryText:
        ((prediction.structuredFormat as AnyRecord | undefined)?.secondaryText as AnyRecord | undefined)?.text || '',
    }))
    .filter((item) => item.placeId && item.description)
}

async function autocompleteWithOpenMaps(query: string) {
  const places = await searchOpenPlaces(query, 7)

  return places.map((place) => {
    const [mainText, ...rest] = place.formattedAddress.split(',').map((part) => part.trim()).filter(Boolean)

    return {
      description: place.formattedAddress,
      mainText: place.name || mainText || place.formattedAddress,
      placeId: place.placeId,
      provider: 'nominatim',
      secondaryText: rest.join(', '),
    }
  })
}

async function placeDetailsWithGoogle(placeId: string): Promise<PlaceDetails> {
  const url = `${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`
  const data = (await fetchGoogleJson(
    url,
    undefined,
    {
      fieldMask: PLACE_DETAILS_FIELD_MASK,
      method: 'GET',
    },
    {
      languageCode: env.googleMaps.language,
    },
  )) as AnyRecord

  return normalizeGooglePlaceDetails(data)
}

async function placeDetailsWithOpenMaps(placeId: string): Promise<PlaceDetails> {
  const parsedPlace = parseOpenPlaceId(placeId)

  if (!parsedPlace) {
    throw new AppError('El identificador de OpenStreetMap no es valido.', 400)
  }

  const lookupId = buildNominatimLookupId(parsedPlace)

  if (lookupId) {
    try {
      const url = new URL(`${normalizeBaseUrl(env.openMaps.nominatimUrl)}/lookup`)
      url.searchParams.set('addressdetails', '1')
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('osm_ids', lookupId)

      const data = (await fetchOpenJson(url)) as AnyRecord[]
      const details = normalizeOpenPlace(data?.[0])

      if (details) {
        return details
      }
    } catch {
      // The encoded coordinates in the place id are enough to continue.
    }
  }

  return parsedPlace.details
}

async function routeWithGoogle(payload: AnyRecord) {
  const origin = buildGoogleWaypoint(payload?.origin)
  const destination = buildGoogleWaypoint(payload?.destination)

  if (!origin || !destination) {
    throw new AppError('Origen y destino son obligatorios para calcular la ruta.', 400)
  }

  const data = (await fetchGoogleJson(
    ROUTES_URL,
    {
      computeAlternativeRoutes: false,
      destination,
      extraComputations: ['TOLLS'],
      languageCode: env.googleMaps.language,
      origin,
      polylineEncoding: 'ENCODED_POLYLINE',
      polylineQuality: 'HIGH_QUALITY',
      regionCode: env.googleMaps.regionCode,
      routingPreference: 'TRAFFIC_AWARE',
      travelMode: 'DRIVE',
      units: 'METRIC',
    },
    {
      fieldMask: ROUTE_FIELD_MASK,
    },
  )) as AnyRecord

  const route = (data.routes as AnyRecord[] | undefined)?.[0]

  if (!route) {
    throw new AppError('Google Maps no encontro una ruta operativa para ese origen y destino.', 404)
  }

  const legs = route.legs as AnyRecord[] | undefined
  const originDetails = await enrichGoogleWaypoint(payload.origin, legs?.[0]?.startLocation)
  const destinationDetails = await enrichGoogleWaypoint(payload.destination, legs?.at(-1)?.endLocation)
  const distanceMeters = Number(route.distanceMeters || 0)
  const durationSeconds = parseGoogleDuration(route.duration)
  const encodedPolyline = (route.polyline as AnyRecord | undefined)?.encodedPolyline || ''

  return {
    bounds: normalizeViewport(route.viewport),
    destination: destinationDetails,
    distanceKm: roundKm(distanceMeters),
    distanceMeters,
    distanceText: formatDistance(distanceMeters),
    durationSeconds,
    durationText: formatDuration(durationSeconds),
    encodedPolyline,
    origin: originDetails,
    provider: 'google',
    staticMapUrl: buildStaticRouteUrl({
      destination: destinationDetails.location,
      origin: originDetails.location,
      polyline: encodedPolyline as string,
    }),
    tolls: normalizeGoogleTollInfo((route.travelAdvisory as AnyRecord | undefined)?.tollInfo),
  }
}

async function routeWithOpenMaps(payload: AnyRecord) {
  const [originDetails, destinationDetails] = await Promise.all([
    resolveOpenWaypoint(payload.origin),
    resolveOpenWaypoint(payload.destination),
  ])

  const osrmRoute = await calculateOsrmRoute(originDetails.location, destinationDetails.location)

  if (osrmRoute) {
    return buildOpenRouteResult({
      destinationDetails,
      durationSeconds: osrmRoute.durationSeconds,
      encodedPolyline: osrmRoute.encodedPolyline,
      originDetails,
      provider: 'osrm',
      routeDistanceMeters: osrmRoute.distanceMeters,
    })
  }

  const fallbackDistanceMeters = Math.round(haversineDistanceMeters(originDetails.location as Location, destinationDetails.location as Location) * ROAD_FACTOR_FALLBACK)
  const fallbackDurationSeconds = Math.round((fallbackDistanceMeters / 1000 / AVERAGE_TRUCK_SPEED_KMH) * 3600)

  return buildOpenRouteResult({
    destinationDetails,
    durationSeconds: fallbackDurationSeconds,
    encodedPolyline: '',
    originDetails,
    provider: 'fallback',
    routeDistanceMeters: fallbackDistanceMeters,
  })
}

interface BuildOpenRouteResultInput {
  destinationDetails: PlaceDetails
  durationSeconds: number
  encodedPolyline: string
  originDetails: PlaceDetails
  provider: string
  routeDistanceMeters: number
}

function buildOpenRouteResult({ destinationDetails, durationSeconds, encodedPolyline, originDetails, provider, routeDistanceMeters }: BuildOpenRouteResultInput) {
  return {
    bounds: buildBounds([originDetails.location, destinationDetails.location]),
    destination: destinationDetails,
    distanceKm: roundKm(routeDistanceMeters),
    distanceMeters: routeDistanceMeters,
    distanceText: formatDistance(routeDistanceMeters),
    durationSeconds,
    durationText: formatDuration(durationSeconds),
    encodedPolyline,
    origin: originDetails,
    provider,
    tolls: normalizeOpenTollInfo(),
  }
}

async function calculateOsrmRoute(origin?: Location, destination?: Location) {
  if (!origin || !destination) {
    return null
  }

  try {
    const baseUrl = normalizeBaseUrl(env.openMaps.osrmUrl)
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
    const url = new URL(`${baseUrl}/route/v1/driving/${coordinates}`)

    url.searchParams.set('geometries', 'polyline')
    url.searchParams.set('overview', 'full')
    url.searchParams.set('steps', 'false')

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': env.openMaps.userAgent,
      },
    })
    const data = (await response.json().catch(() => ({}))) as AnyRecord

    if (!response.ok || data.code !== 'Ok' || !(data.routes as AnyRecord[] | undefined)?.[0]) {
      return null
    }

    const route = (data.routes as AnyRecord[])[0]
    const distanceMeters = Math.round(Number(route.distance || 0))
    const durationSeconds = Math.round(Number(route.duration || 0))

    if (distanceMeters <= 0) {
      return null
    }

    return {
      distanceMeters,
      durationSeconds,
      encodedPolyline: (route.geometry as string) || '',
    }
  } catch {
    return null
  }
}

async function resolveOpenWaypoint(input: unknown): Promise<PlaceDetails> {
  const address = getWaypointText(input)
  const placeId = typeof input === 'object' ? normalizePlaceId((input as AnyRecord)?.placeId) : ''
  const parsedPlace = parseOpenPlaceId(placeId, address)

  if (parsedPlace?.details?.location && !address) {
    return parsedPlace.details
  }

  if (address) {
    const places = await searchOpenPlaces(address, 1)

    if (places[0]) {
      return places[0]
    }
  }

  if (parsedPlace?.details?.location) {
    return {
      ...parsedPlace.details,
      formattedAddress: parsedPlace.details.formattedAddress || address,
    }
  }

  throw new AppError(`No se pudo geocodificar "${address || 'direccion'}". Ajusta origen/destino o registra km manual.`, 404)
}

async function searchOpenPlaces(query: unknown, limit = 7): Promise<PlaceDetails[]> {
  const normalizedQuery = String(query || '').trim()

  if (normalizedQuery.length < 3) {
    return []
  }

  const knownPlaces = findKnownChilePlaces(normalizedQuery, limit)

  try {
    const url = new URL(`${normalizeBaseUrl(env.openMaps.nominatimUrl)}/search`)
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('countrycodes', env.googleMaps.country || 'cl')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('q', normalizedQuery)

    const data = (await fetchOpenJson(url)) as unknown
    const places = (Array.isArray(data) ? (data as AnyRecord[]) : [])
      .map(normalizeOpenPlace)
      .filter((place): place is PlaceDetails => Boolean(place))

    return dedupePlaces([...places, ...knownPlaces]).slice(0, limit)
  } catch {
    return knownPlaces
  }
}

interface FetchGoogleOptions {
  fieldMask?: string
  method?: string
}

async function fetchGoogleJson(url: string, body: AnyRecord | undefined, options: FetchGoogleOptions = {}, query: AnyRecord = {}): Promise<unknown> {
  requireGoogleMapsKey()

  const requestUrl = new URL(url)

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      requestUrl.searchParams.set(key, String(value))
    }
  })

  const method = options.method || 'POST'
  const response = await fetch(requestUrl, {
    body: method === 'GET' ? undefined : JSON.stringify(removeUndefined(body || {})),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.googleMaps.apiKey,
      'X-Goog-FieldMask': options.fieldMask || '*',
    },
    method,
  })

  const data = (await response.json().catch(() => ({}))) as AnyRecord

  if (!response.ok) {
    throw new AppError((data.error as AnyRecord | undefined)?.message as string || 'Google Maps rechazo la solicitud.', response.status, data.error)
  }

  return data
}

async function fetchOpenJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': env.googleMaps.language || 'es',
      'User-Agent': env.openMaps.userAgent,
    },
  })
  const data = (await response.json().catch(() => ({}))) as unknown

  if (!response.ok) {
    throw new AppError('OpenStreetMap rechazo la solicitud de geocodificacion.', 502, {
      status: response.status,
    })
  }

  return data
}

function buildGoogleWaypoint(value: unknown): AnyRecord | null {
  if (typeof value === 'string') {
    const address = value.trim()
    return address ? { address } : null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as AnyRecord

  if (record.placeId) {
    return { placeId: normalizePlaceId(record.placeId) }
  }

  const address = String(record.address || record.formattedAddress || '').trim()

  return address ? { address } : null
}

async function enrichGoogleWaypoint(input: unknown, fallbackLocation: unknown): Promise<PlaceDetails> {
  const record = typeof input === 'object' && input ? (input as AnyRecord) : undefined
  const address = typeof input === 'string' ? input : record?.address || record?.formattedAddress
  const fallback: PlaceDetails = {
    city: '',
    country: '',
    formattedAddress: String(address || '').trim(),
    location: normalizeLocation(fallbackLocation),
    placeId: typeof input === 'object' ? normalizePlaceId(record?.placeId) : undefined,
    postalCode: '',
    region: '',
  }

  if (typeof input === 'object' && record?.placeId) {
    try {
      return await new MapsService().placeDetails(record.placeId)
    } catch {
      return fallback
    }
  }

  return fallback
}

function normalizeGooglePlaceDetails(place: AnyRecord): PlaceDetails {
  const postalAddress = (place.postalAddress as AnyRecord | undefined) || {}
  const location = normalizeLocation(place.location)

  return {
    city: (postalAddress.locality as string) || getAddressComponent(place.addressComponents as AnyRecord[] | undefined, 'locality'),
    country: (postalAddress.regionCode as string) || getAddressComponent(place.addressComponents as AnyRecord[] | undefined, 'country'),
    formattedAddress: (place.formattedAddress as string) || '',
    location,
    name: (place.displayName as AnyRecord | undefined)?.text as string || '',
    placeId: place.id as string | undefined,
    postalCode: (postalAddress.postalCode as string) || getAddressComponent(place.addressComponents as AnyRecord[] | undefined, 'postal_code'),
    region: (postalAddress.administrativeArea as string) || getAddressComponent(place.addressComponents as AnyRecord[] | undefined, 'administrative_area_level_1'),
  }
}

function normalizeOpenPlace(place: AnyRecord | undefined | null): PlaceDetails | null {
  if (!place) {
    return null
  }

  const location = normalizeLocation({ lat: place.lat, lng: place.lon })

  if (!location) {
    return null
  }

  const address = (place.address as AnyRecord | undefined) || {}
  const formattedAddress =
    (place.display_name as string) ||
    [place.name, address.road, address.city, address.state, address.country].filter(Boolean).join(', ')
  const name =
    (place.name as string) ||
    (address.amenity as string) ||
    (address.road as string) ||
    (address.suburb as string) ||
    (address.city as string) ||
    (address.town as string) ||
    (address.village as string) ||
    formattedAddress.split(',')[0]

  return {
    city: (address.city as string) || (address.town as string) || (address.village as string) || (address.municipality as string) || (address.county as string) || '',
    country: String(address.country_code || '').toUpperCase() || (address.country as string) || '',
    formattedAddress,
    location,
    name,
    placeId: buildOpenPlaceId(place),
    postalCode: (address.postcode as string) || '',
    region: (address.state as string) || (address.region as string) || '',
  }
}

function buildOpenPlaceId(place: AnyRecord): string {
  const lat = Number(place.lat)
  const lng = Number(place.lon)

  return `osm:${place.osm_type || 'node'}:${place.osm_id || place.place_id}:${lat}:${lng}`
}

function parseOpenPlaceId(placeId: unknown, address = ''): ParsedOpenPlace | null {
  if (!isOpenPlaceId(placeId)) {
    return null
  }

  const [, osmType = 'node', osmId = '', latRaw = '', lngRaw = ''] = String(placeId).split(':')
  const lat = Number(latRaw)
  const lng = Number(lngRaw)
  const location = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined

  return {
    osmId,
    osmType,
    details: {
      city: '',
      country: '',
      formattedAddress: String(address || '').trim(),
      location,
      name: String(address || '').split(',')[0] || '',
      placeId: String(placeId),
      postalCode: '',
      region: '',
    },
  }
}

function buildNominatimLookupId(parsedPlace: ParsedOpenPlace): string {
  if (!parsedPlace?.osmId) {
    return ''
  }

  const typePrefix = ({
    node: 'N',
    relation: 'R',
    way: 'W',
  } as Record<string, string>)[String(parsedPlace.osmType || '').toLowerCase()]

  return typePrefix ? `${typePrefix}${parsedPlace.osmId}` : ''
}

function findKnownChilePlaces(query: string, limit: number): PlaceDetails[] {
  const normalizedQuery = normalizeSearchText(query)

  return KNOWN_CHILE_PLACES.filter((place) =>
    place.terms.some((term) => normalizedQuery.includes(normalizeSearchText(term))) ||
    normalizeSearchText(place.formattedAddress).includes(normalizedQuery),
  )
    .map((place) => ({
      ...place,
      placeId: `osm:known:${normalizeSearchText(place.name).replace(/\s+/g, '-')}:${place.location.lat}:${place.location.lng}`,
      postalCode: '',
    }))
    .slice(0, limit)
}

function dedupePlaces(places: PlaceDetails[]): PlaceDetails[] {
  const seen = new Set<string>()

  return places.filter((place) => {
    const key = place.placeId || `${place.location?.lat}:${place.location?.lng}:${place.formattedAddress}`

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function hasWaypointInput(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length >= 3
  }

  if (!value || typeof value !== 'object') {
    return false
  }

  return Boolean(getWaypointText(value) || normalizePlaceId((value as AnyRecord).placeId))
}

function inputHasOpenPlaceId(value: unknown): boolean {
  return typeof value === 'object' && value !== null && isOpenPlaceId(normalizePlaceId((value as AnyRecord)?.placeId))
}

function getWaypointText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const record = value as AnyRecord

  return String(record.address || record.formattedAddress || record.description || record.name || '').trim()
}

function normalizePlaceId(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^places\//, '')
}

function isOpenPlaceId(placeId: unknown): boolean {
  return String(placeId || '').startsWith('osm:')
}

function normalizeLocation(location: unknown): Location | undefined {
  if (!location) {
    return undefined
  }

  const record = location as AnyRecord
  const lat = Number(record.latitude ?? (record.latLng as AnyRecord | undefined)?.latitude ?? record.lat)
  const lng = Number(record.longitude ?? (record.latLng as AnyRecord | undefined)?.longitude ?? record.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined
  }

  return { lat, lng }
}

function normalizeViewport(viewport: unknown) {
  if (!viewport) {
    return undefined
  }

  const record = viewport as AnyRecord

  return {
    high: normalizeLocation(record.high),
    low: normalizeLocation(record.low),
  }
}

function buildBounds(locations: Array<Location | undefined>) {
  const validLocations = locations.filter((location): location is Location => Boolean(location))

  if (validLocations.length === 0) {
    return undefined
  }

  const latitudes = validLocations.map((location) => location.lat)
  const longitudes = validLocations.map((location) => location.lng)

  return {
    high: {
      lat: Math.max(...latitudes),
      lng: Math.max(...longitudes),
    },
    low: {
      lat: Math.min(...latitudes),
      lng: Math.min(...longitudes),
    },
  }
}

function normalizeGoogleTollInfo(tollInfo: unknown) {
  const estimatedPrices = (((tollInfo as AnyRecord | undefined)?.estimatedPrice as AnyRecord[] | undefined) || []).map((price) => {
    const units = Number(price.units || 0)
    const nanos = Number(price.nanos || 0)

    return {
      amount: Math.round((units + nanos / 1_000_000_000) * 100) / 100,
      currencyCode: (price.currencyCode as string) || 'CLP',
      nanos,
      units,
    }
  })
  const primaryCurrency = estimatedPrices[0]?.currencyCode || 'CLP'
  const totalAmount = Math.round(
    estimatedPrices
      .filter((price) => price.currencyCode === primaryCurrency)
      .reduce((sum, price) => sum + price.amount, 0),
  )

  return {
    currencyCode: primaryCurrency,
    estimatedPrices,
    hasTolls: Boolean(tollInfo),
    priceKnown: estimatedPrices.length > 0,
    source: 'google-routes',
    totalAmount,
  }
}

function normalizeOpenTollInfo() {
  return {
    currencyCode: 'CLP',
    estimatedPrices: [],
    hasTolls: false,
    priceKnown: false,
    source: 'not-available',
    totalAmount: 0,
  }
}

function getAddressComponent(components: AnyRecord[] = [], type: string): string {
  return (components.find((component) => (component.types as string[] | undefined)?.includes(type))?.longText as string) || ''
}

function parseGoogleDuration(value: unknown): number {
  const match = String(value || '').match(/^(\d+(?:\.\d+)?)s$/)

  return match ? Math.round(Number(match[1])) : 0
}

function haversineDistanceMeters(origin: Location, destination: Location): number {
  const earthRadiusMeters = 6371_000
  const lat1 = toRadians(origin.lat)
  const lat2 = toRadians(destination.lat)
  const deltaLat = toRadians(destination.lat - origin.lat)
  const deltaLng = toRadians(destination.lng - origin.lng)
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMeters * c
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function roundKm(distanceMeters: unknown): number {
  return Math.round((Number(distanceMeters || 0) / 1000) * 10) / 10
}

function formatDistance(distanceMeters: number): string {
  if (!distanceMeters) {
    return '0 km'
  }

  return `${(distanceMeters / 1000).toLocaleString('es-CL', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })} km`
}

function formatDuration(seconds: number): string {
  if (!seconds) {
    return 'Por calcular'
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours} h`
  }

  return `${hours} h ${minutes} min`
}

interface BuildStaticRouteUrlInput {
  destination?: Location
  origin?: Location
  polyline: string
}

function buildStaticRouteUrl({ destination, origin, polyline }: BuildStaticRouteUrlInput): string | undefined {
  if (!origin || !destination || !polyline) {
    return undefined
  }

  const params = new URLSearchParams({
    destinationLat: String(destination.lat),
    destinationLng: String(destination.lng),
    originLat: String(origin.lat),
    originLng: String(origin.lng),
    polyline,
  })

  return `/maps/static-route?${params.toString()}`
}

function hasGoogleMapsKey(): boolean {
  return Boolean(env.googleMaps.apiKey)
}

function requireGoogleMapsKey(): void {
  if (!hasGoogleMapsKey()) {
    throw new AppError('Configura GOOGLE_MAPS_API_KEY en el backend para usar Google Maps.', 503)
  }
}

function normalizeBaseUrl(value: unknown): string {
  return String(value || '').replace(/\/+$/, '')
}

function normalizeSearchText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function removeUndefined(value: AnyRecord): AnyRecord {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

function getCached(key: string): unknown {
  const cached = cache.get(key)

  if (!cached || cached.expiresAt < Date.now()) {
    cache.delete(key)
    return undefined
  }

  return cached.value
}

function setCached(key: string, value: unknown): void {
  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  })
}
