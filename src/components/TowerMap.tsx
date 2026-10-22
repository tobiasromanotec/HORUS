import { useEffect, useMemo, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { FeatureCollection } from "geojson";
import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin, WifiOff } from "lucide-react";
import type { Tower } from "../types";
import "leaflet/dist/leaflet.css";
import "./monitoring.css";

interface TowerMapProps {
  towers: Tower[];
  selectedId?: string;
  onSelect?: (tower: Tower) => void;
  compact?: boolean;
}

const statusLabels: Record<Tower["status"], string> = {
  operativo: "Operativo",
  atencion: "Requiere atención",
  desconectado: "Desconectado",
};

const mapLabels: {
  name: string;
  position: [number, number];
  region?: boolean;
}[] = [
  { name: "Añelo", position: [-38.354, -68.787] },
  { name: "Neuquén", position: [-38.952, -68.06] },
  { name: "San Patricio del Chañar", position: [-38.625, -68.299] },
  { name: "Rincón de los Sauces", position: [-37.39, -68.926] },
  { name: "Cutral Có", position: [-38.938, -69.232] },
  { name: "Centenario", position: [-38.83, -68.14] },
  { name: "NEUQUÉN", position: [-38.57, -69.18], region: true },
  { name: "RÍO NEGRO", position: [-39.18, -67.58], region: true },
  { name: "MENDOZA", position: [-36.8, -68.6], region: true },
];

function LocalGeography() {
  const [geography, setGeography] = useState<FeatureCollection | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/assets/region.geojson", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Local geography unavailable");
        return response.json();
      })
      .then(setGeography)
      .catch(() => {
        /* Coordinate positions remain available even if local geography fails. */
      });
    return () => controller.abort();
  }, []);
  return (
    <>
      <Pane name="localGeography" style={{ zIndex: 150 }}>
        {geography && (
          <GeoJSON
            data={geography}
            interactive={false}
            attribution='&copy; <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a> (mapa local)'
            style={(feature) =>
              feature?.properties?.kind === "river"
                ? { color: "#a3b8b6", weight: 2.4, opacity: 0.8 }
                : feature?.properties?.kind === "province"
                  ? {
                      color: "#bdc3b8",
                      weight: 1.2,
                      dashArray: "5 5",
                      opacity: 0.9,
                    }
                  : {
                      color: "#b5beaf",
                      weight: 1.1,
                      fillColor: "#e8e9df",
                      fillOpacity: 1,
                    }
            }
          />
        )}
      </Pane>
      <Pane name="localLabels" style={{ zIndex: 160 }}>
        {mapLabels.map((label) => (
          <Marker
            key={label.name}
            position={label.position}
            interactive={false}
            keyboard={false}
            icon={divIcon({
              className: `map-local-label${label.region ? " map-local-region" : ""}`,
              html: `<span>${label.name}</span>`,
              iconSize: [140, 20],
              iconAnchor: [label.region ? 70 : 0, 10],
            })}
          />
        ))}
      </Pane>
    </>
  );
}

function MapPosition({
  towers,
  selectedId,
}: Pick<TowerMapProps, "towers" | "selectedId">) {
  const map = useMap();
  const coordinates = towers
    .map((tower) => `${tower.id}:${tower.lat}:${tower.lng}`)
    .join("|");
  useEffect(() => {
    if (towers.length) {
      map.fitBounds(
        latLngBounds(towers.map((tower) => [tower.lat, tower.lng])),
        {
          padding: [55, 55],
          maxZoom: 11,
          animate: false,
        },
      );
    }
    // Reposition only when the actual coordinates change, not on unrelated data refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, coordinates]);
  useEffect(() => {
    const selected = towers.find((tower) => tower.id === selectedId);
    if (selected)
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 10), {
        duration: 0.6,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedId, coordinates]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function towerIcon(status: Tower["status"], selected: boolean) {
  return divIcon({
    className: `map-rig-icon map-rig-${status}${selected ? " map-rig-selected" : ""}`,
    html: '<span class="map-rig-dot"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 3h6M10 3 5 21M14 3l5 18M4 21h16M8.5 9h7M7 15h10M9 9l8 6M15 9l-8 6M7 15l11 6M17 15 6 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -21],
  });
}

export default function TowerMap({
  towers,
  selectedId,
  onSelect,
  compact = false,
}: TowerMapProps) {
  const [tileError, setTileError] = useState(false);
  const validTowers = useMemo(
    () =>
      towers.filter(
        (tower) => Number.isFinite(tower.lat) && Number.isFinite(tower.lng),
      ),
    [towers],
  );
  return (
    <div
      className={`map-shell${compact ? " map-compact" : ""}${tileError ? " map-without-tiles" : ""}`}
      aria-label="Mapa de ubicación de torres petroleras"
    >
      <MapContainer
        center={[-38.44, -68.84]}
        zoom={9}
        scrollWheelZoom={!compact}
        className="map-leaflet"
        attributionControl
        zoomControl
      >
        <LocalGeography />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
          subdomains="abcd"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <MapPosition towers={validTowers} selectedId={selectedId} />
        {validTowers.map((tower) => (
          <Marker
            key={tower.id}
            position={[tower.lat, tower.lng]}
            title={`${tower.name} · ${tower.location}`}
            icon={towerIcon(tower.status, tower.id === selectedId)}
            eventHandlers={{ click: () => onSelect?.(tower) }}
          >
            <Popup>
              <div className="map-popup">
                <span className="map-popup-type">{tower.type}</span>
                <strong>{tower.name}</strong>
                <span>{tower.location}</span>
                <span className={`map-popup-status map-status-${tower.status}`}>
                  <i />
                  {statusLabels[tower.status]}
                </span>
                <small>
                  {tower.lat.toFixed(5)}, {tower.lng.toFixed(5)}
                </small>
                <Link to={`/equipos/${tower.id}`}>
                  Ver equipo <ArrowUpRight size={15} />
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {!validTowers.length && (
        <div className="map-empty">
          <MapPin size={25} />
          <strong>No hay torres para mostrar</strong>
          <span>Prueba con otros filtros o registra un equipo.</span>
        </div>
      )}
      {tileError && (
        <div className="map-offline" role="status">
          <WifiOff size={14} />
          <span>Mapa local · cartografía en línea no disponible.</span>
        </div>
      )}
      {!compact && (
        <div className="map-overlay-legend">
          <span>
            <i className="map-dot-operativo" />
            Operativo
          </span>
          <span>
            <i className="map-dot-atencion" />
            Atención
          </span>
          <span>
            <i className="map-dot-desconectado" />
            Desconectado
          </span>
        </div>
      )}
      <div className="map-region">
        <MapPin size={12} /> CUENCA NEUQUINA · ARGENTINA
      </div>
    </div>
  );
}
