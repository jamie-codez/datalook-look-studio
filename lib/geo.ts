export interface GeoPoint {
  lat: number
  lng: number
  /** row index this point came from */
  index: number
  /** short human label derived from the row (name/city/id) */
  label: string
}

export interface GeoSchema {
  /** how coordinates are stored in the result set */
  kind: 'pair' | 'single'
  /** column holding latitude (pair) */
  latKey?: string
  /** column holding longitude (pair) */
  lngKey?: string
  /** column holding a combined value like "lat,lng" or "POINT(lng lat)" (single) */
  geoKey?: string
  /** best-guess column to use as a marker label */
  labelKey?: string
}

const LAT_NAMES = ['latitude', 'lat']
const LNG_NAMES = ['longitude', 'longitud', 'long', 'lng', 'lon']
const SINGLE_NAMES = ['location', 'coordinates', 'coords', 'geo', 'geom', 'point', 'position', 'latlng']
const LABEL_PREF = ['name', 'full_name', 'title', 'label', 'city', 'company', 'store', 'email', 'id']

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isValidLat(n: number) {
  return Number.isFinite(n) && n >= -90 && n <= 90
}
function isValidLng(n: number) {
  return Number.isFinite(n) && n >= -180 && n <= 180
}

/**
 * Inspect column names to determine whether a result set carries geolocation
 * data, and how it is encoded. Returns null when no coordinates are present.
 */
export function detectGeoSchema(columns: string[]): GeoSchema | null {
  const byNorm = new Map(columns.map((c) => [norm(c), c]))

  // 1. Explicit lat / lng column pair.
  const latKey = LAT_NAMES.map(norm).map((n) => byNorm.get(n)).find(Boolean)
  const lngKey = LNG_NAMES.map(norm).map((n) => byNorm.get(n)).find(Boolean)
  const labelKey = LABEL_PREF.map(norm)
    .map((n) => byNorm.get(n))
    .find(Boolean)

  if (latKey && lngKey) {
    return { kind: 'pair', latKey, lngKey, labelKey }
  }

  // 2. Single combined column (e.g. "location" = "40.71,-74.01").
  const geoKey = SINGLE_NAMES.map(norm)
    .map((n) => byNorm.get(n))
    .find(Boolean)
  if (geoKey) {
    return { kind: 'single', geoKey, labelKey }
  }

  return null
}

/** Parse a combined coordinate string into [lat, lng] or null. */
export function parseCoordString(raw: unknown): [number, number] | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()

  // WKT POINT(lng lat)
  const wkt = s.match(/point\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i)
  if (wkt) {
    const lng = Number(wkt[1])
    const lat = Number(wkt[2])
    if (isValidLat(lat) && isValidLng(lng)) return [lat, lng]
  }

  // Plain "lat,lng" or "lat, lng"
  const parts = s.split(/\s*,\s*/)
  if (parts.length === 2) {
    const lat = Number(parts[0])
    const lng = Number(parts[1])
    if (isValidLat(lat) && isValidLng(lng)) return [lat, lng]
  }
  return null
}

/** Extract the coordinate for a single row, or null if it is not geolocatable. */
export function coordForRow(
  row: Record<string, unknown>,
  schema: GeoSchema,
): [number, number] | null {
  if (schema.kind === 'pair' && schema.latKey && schema.lngKey) {
    const lat = Number(row[schema.latKey])
    const lng = Number(row[schema.lngKey])
    if (isValidLat(lat) && isValidLng(lng)) return [lat, lng]
    return null
  }
  if (schema.kind === 'single' && schema.geoKey) {
    return parseCoordString(row[schema.geoKey])
  }
  return null
}

/** Build a marker label for a row using the best available column. */
export function labelForRow(
  row: Record<string, unknown>,
  schema: GeoSchema,
  index: number,
): string {
  if (schema.labelKey && row[schema.labelKey] != null) {
    return String(row[schema.labelKey])
  }
  return `Row ${index + 1}`
}

/** Collect every geolocatable point in a result set. */
export function collectPoints(
  rows: Record<string, unknown>[],
  schema: GeoSchema,
): GeoPoint[] {
  const points: GeoPoint[] = []
  rows.forEach((row, index) => {
    const c = coordForRow(row, schema)
    if (c) {
      points.push({ lat: c[0], lng: c[1], index, label: labelForRow(row, schema, index) })
    }
  })
  return points
}
