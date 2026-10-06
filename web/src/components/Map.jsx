import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { dateTime, ago, DRIVER_STATUS } from "../format.js";

// Подложка OpenStreetMap. Для продакшена с большой нагрузкой нужен свой тайл-провайдер (условия OSM).
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const KZ_CENTER = [48.0, 67.0];

// Leaflet пишет цвета в SVG-атрибуты, где CSS-переменные не работают, — поэтому hex
const COLORS = { primary: "#2f6fd6", success: "#2e9e6a", muted: "#8a93a5" };

/** Иконка машины: круг с грузовиком, «пульс» если сигнал живой, поворот по курсу */
function truckIcon({ live, heading, color = "var(--primary)" }) {
  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="truck-pin ${live ? "live" : ""}" style="--pin:${color}">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
        style="transform: rotate(${heading != null ? heading - 90 : 0}deg)">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/>
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
      </svg></div>`,
  });
}

function FitBounds({ points, padding = 40 }) {
  const map = useMap();
  const key = JSON.stringify(points.map(([a, b]) => [a.toFixed(2), b.toFixed(2)]));
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 9);
    else map.fitBounds(L.latLngBounds(points), { padding: [padding, padding] });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Карта рейса: план (пунктир), фактический трек, точки загрузки/выгрузки, машина */
export function TrackMap({ track, height = 360 }) {
  const { primary, success, muted } = COLORS;
  const { origin, destination, last } = track;
  const fit = useMemo(() => {
    const pts = [];
    if (origin) pts.push([origin.lat, origin.lon]);
    if (destination) pts.push([destination.lat, destination.lon]);
    if (last) pts.push([last.lat, last.lon]);
    return pts;
  }, [origin, destination, last]);

  return (
    <div className="map-box" style={{ height }}>
      <MapContainer center={fit[0] ?? KZ_CENTER} zoom={5} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer url={TILES} attribution={ATTRIBUTION} />
        <FitBounds points={fit} />
        {origin && destination && (
          <Polyline positions={[[origin.lat, origin.lon], [destination.lat, destination.lon]]} pathOptions={{ color: muted, weight: 2, dashArray: "6 8", opacity: 0.8 }} />
        )}
        {track.track?.length > 1 && <Polyline positions={track.track} pathOptions={{ color: primary, weight: 4, opacity: 0.85 }} />}
        {origin && (
          <CircleMarker center={[origin.lat, origin.lon]} radius={7} pathOptions={{ color: "white", weight: 2, fillColor: primary, fillOpacity: 1 }}>
            <Popup>Загрузка: {origin.city}</Popup>
          </CircleMarker>
        )}
        {destination && (
          <CircleMarker center={[destination.lat, destination.lon]} radius={8} pathOptions={{ color: "white", weight: 2, fillColor: success, fillOpacity: 1 }}>
            <Popup>Выгрузка: {destination.city}</Popup>
          </CircleMarker>
        )}
        {last && (
          <Marker position={[last.lat, last.lon]} icon={truckIcon({ live: track.signal === "live", heading: null })}>
            <Popup>
              <strong>{track.signal === "live" ? "На связи" : `Последний сигнал ${ago(last.at)}`}</strong><br />
              {last.speed_kmh != null && <>{Math.round(last.speed_kmh)} км/ч · </>}{last.nearest.km <= 15 ? last.nearest.name : `${last.nearest.name}, ${last.nearest.km} км`}<br />
              <span style={{ opacity: 0.7 }}>{dateTime(last.at)}</span>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

const STATUS_COLORS = { free: "var(--success)", busy: "var(--info)", offline: "var(--muted-fg)" };

/** Карта парка: точные координаты по своим рейсам, остальные машины — в своём городе */
export function FleetMap({ drivers, height = 520 }) {
  const fit = useMemo(() => drivers.map((d) => [d.lat, d.lon]), [drivers]);
  // Несколько машин в одном городе: слегка разносим маркеры, чтобы не слипались
  const placed = useMemo(() => {
    const seen = {};
    return drivers.map((d) => {
      if (d.exact) return d;
      const key = `${d.lat.toFixed(2)},${d.lon.toFixed(2)}`;
      const n = (seen[key] = (seen[key] ?? -1) + 1);
      const angle = n * 2.4, r = n ? 0.06 + n * 0.015 : 0;
      return { ...d, lat: d.lat + Math.sin(angle) * r, lon: d.lon + Math.cos(angle) * r * 1.4 };
    });
  }, [drivers]);

  return (
    <div className="map-box" style={{ height }}>
      <MapContainer center={KZ_CENTER} zoom={5} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer url={TILES} attribution={ATTRIBUTION} />
        <FitBounds points={fit} padding={50} />
        {placed.map((d) => (
          <Marker key={d.id} position={[d.lat, d.lon]}
            icon={truckIcon({ live: d.exact && d.position_at && Date.now() - new Date(d.position_at) < 30 * 60000, color: STATUS_COLORS[d.status] })}>
            <Popup>
              <strong>{d.name}</strong> · {DRIVER_STATUS[d.status]?.label}<br />
              {d.vehicle_model} · {d.body} · {d.capacity} т · ★ {d.rating}<br />
              {d.trip
                ? <>Рейс <Link to={`/cargos/${d.trip.code}`}>{d.trip.code}</Link> {d.trip.from_city} → {d.trip.to_city}<br />
                    {d.speed_kmh != null && `${Math.round(d.speed_kmh)} км/ч · `}GPS {d.position_at ? ago(d.position_at) : "нет"}</>
                : <span style={{ opacity: 0.7 }}>{d.city} · местоположение примерное</span>}
              <br /><a href={`tel:${d.phone}`}>{d.phone}</a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
