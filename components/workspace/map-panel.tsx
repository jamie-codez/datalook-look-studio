"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import type { Map as LeafletMap, Marker, TileLayer } from "leaflet"
import type { GeoPoint } from "@/lib/geo"
import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/button"
import { MapPinIcon, XIcon } from "lucide-react"

interface MapPanelProps {
  points: GeoPoint[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  onClose: () => void
}

const TILE_URLS = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
}
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function MapPanel({ points, selectedIndex, onSelect, onClose }: MapPanelProps) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const tileRef = useRef<TileLayer | null>(null)
  const markersRef = useRef<Map<number, Marker>>(new Map())
  const LRef = useRef<typeof import("leaflet") | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  // Flips to true once the async Leaflet import + map init completes, so the
  // marker/selection effects re-run after the map actually exists.
  const [ready, setReady] = useState(false)

  // Initialise the map once (client-only via dynamic import).
  useEffect(() => {
    let cancelled = false
    async function init() {
      const L = (await import("leaflet")).default
      if (cancelled || !containerRef.current || mapRef.current) return
      LRef.current = L
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView([20, 0], 2)
      mapRef.current = map
      tileRef.current = L.tileLayer(TILE_URLS[theme === "light" ? "light" : "dark"], {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map)
      // Leaflet needs a size recalculation once the flex panel has laid out.
      setTimeout(() => map.invalidateSize(), 60)
      setReady(true)
    }
    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current.clear()
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap tiles when the theme changes.
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return
    tileRef.current?.remove()
    tileRef.current = L.tileLayer(TILE_URLS[theme === "light" ? "light" : "dark"], {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map)
  }, [theme, ready])

  // Rebuild markers whenever the point set changes.
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()

    points.forEach((p) => {
      const icon = L.divIcon({
        className: "",
        html: `<span class="dl-marker" data-selected="${p.index === selectedIndex}"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      const marker = L.marker([p.lat, p.lng], { icon })
        .addTo(map)
        .bindTooltip(p.label, { direction: "top", offset: [0, -8] })
      marker.on("click", () => onSelectRef.current(p.index))
      markersRef.current.set(p.index, marker)
    })

    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }
    setTimeout(() => map.invalidateSize(), 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, ready])

  // React to selection: refresh marker styles and fly to the active point.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((marker, index) => {
      const el = marker.getElement()?.querySelector(".dl-marker") as HTMLElement | null
      if (el) el.dataset.selected = String(index === selectedIndex)
    })
    if (selectedIndex != null) {
      const p = points.find((pt) => pt.index === selectedIndex)
      if (p) {
        map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 6), { duration: 0.6 })
        markersRef.current.get(selectedIndex)?.openTooltip()
      }
    }
  }, [selectedIndex, points, ready])

  const selectedPoint = selectedIndex != null ? points.find((p) => p.index === selectedIndex) : null

  return (
    <div className="flex h-full w-full flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <MapPinIcon className="size-4 text-primary" aria-hidden />
        <span className="text-sm font-medium text-foreground">Location</span>
        <span className="font-mono text-xs text-muted-foreground">
          {points.length} {points.length === 1 ? "point" : "points"}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={onClose}
          aria-label="Close map"
        >
          <XIcon />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" aria-label="Map of row locations" />
      </div>

      <div className="border-t border-border px-3 py-2 text-xs">
        {selectedPoint ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{selectedPoint.label}</span>
            <span className="font-mono text-muted-foreground">
              {selectedPoint.lat.toFixed(5)}, {selectedPoint.lng.toFixed(5)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">Select a row or marker to focus a location.</span>
        )}
      </div>
    </div>
  )
}
