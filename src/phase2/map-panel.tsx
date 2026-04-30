"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatComparableRowSummary,
  normalizeComparableRowForDisplay,
} from "@/phase2/comparable-row";
import type {
  VisualComparableRow,
  VisualExtractedParcelFields,
  VisualKmlData,
} from "@/phase2/types";

const OPENLAYERS_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/ol@10.9.0/dist/ol.js";
const OPENLAYERS_CSS_URL = "https://cdn.jsdelivr.net/npm/ol@10.9.0/ol.css";
const USGS_IMAGERY_TOPO_URL =
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}";
const USGS_IMAGERY_ONLY_URL =
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";
const DEFAULT_CENTER_LON_LAT: LonLat = [-98.5795, 39.8283];
const METERS_PER_MILE = 1609.344;

type LonLat = [number, number];
type OpenLayersGlobal = Record<string, any>;

let openLayersLoadPromise: Promise<OpenLayersGlobal> | null = null;

function loadOpenLayers() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenLayers can only load in the browser."));
  }

  const existingOpenLayers = (window as Window & { ol?: OpenLayersGlobal }).ol;

  if (existingOpenLayers) {
    return Promise.resolve(existingOpenLayers);
  }

  if (openLayersLoadPromise) {
    return openLayersLoadPromise;
  }

  openLayersLoadPromise = new Promise((resolve, reject) => {
    const existingLink = document.querySelector<HTMLLinkElement>(
      `link[href="${OPENLAYERS_CSS_URL}"]`,
    );

    if (!existingLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = OPENLAYERS_CSS_URL;
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${OPENLAYERS_SCRIPT_URL}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        const loadedOpenLayers = (window as Window & { ol?: OpenLayersGlobal }).ol;
        loadedOpenLayers ? resolve(loadedOpenLayers) : reject(new Error("OpenLayers did not initialize."));
      });
      existingScript.addEventListener("error", () => reject(new Error("OpenLayers failed to load.")));
      return;
    }

    const script = document.createElement("script");
    script.src = OPENLAYERS_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const loadedOpenLayers = (window as Window & { ol?: OpenLayersGlobal }).ol;
      loadedOpenLayers ? resolve(loadedOpenLayers) : reject(new Error("OpenLayers did not initialize."));
    };
    script.onerror = () => reject(new Error("OpenLayers failed to load."));
    document.head.appendChild(script);
  });

  return openLayersLoadPromise;
}

function parseGps(value: string | undefined): LonLat | null {
  const matches = String(value || "").match(/-?\d+(?:\.\d+)?/g);

  if (!matches || matches.length < 2) {
    return null;
  }

  const first = Number(matches[0]);
  const second = Number(matches[1]);

  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }

  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    return [second, first];
  }

  if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
    return [first, second];
  }

  return null;
}

function isValidLonLat(coordinate: LonLat) {
  return (
    Number.isFinite(coordinate[0]) &&
    Number.isFinite(coordinate[1]) &&
    Math.abs(coordinate[0]) <= 180 &&
    Math.abs(coordinate[1]) <= 90
  );
}

function kmlCoordinatesToLonLat(kmlData: VisualKmlData | null | undefined): LonLat[] {
  return (kmlData?.coordinates ?? [])
    .map<LonLat>((coordinate) => [coordinate.lon, coordinate.lat])
    .filter(isValidLonLat);
}

function getMaxComparableDistanceMiles(rows: VisualComparableRow[] | undefined) {
  const distances = (rows ?? [])
    .map((row) => Number(normalizeComparableRowForDisplay(row).distance))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 250);

  return distances.length ? Math.max(...distances) : null;
}

function getMapAttributionLabel(baseLayer: "topo" | "imagery") {
  return baseLayer === "topo" ? "USGS Imagery Topo" : "USGS Imagery Only";
}

function buildPointStyle(ol: OpenLayersGlobal) {
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: 8,
      fill: new ol.style.Fill({ color: "#2457ff" }),
      stroke: new ol.style.Stroke({ color: "#ffffff", width: 3 }),
    }),
  });
}

function buildPolygonStyle(ol: OpenLayersGlobal) {
  return new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(36, 180, 210, 0.18)" }),
    stroke: new ol.style.Stroke({ color: "#24b4d2", width: 3 }),
  });
}

function buildRadiusStyle(ol: OpenLayersGlobal) {
  return new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(134, 72, 255, 0.08)" }),
    stroke: new ol.style.Stroke({ color: "#8648ff", lineDash: [10, 8], width: 2 }),
  });
}

export function Phase2MapPanel({
  fields,
  kmlData,
  comparableRows,
}: {
  fields?: VisualExtractedParcelFields;
  kmlData?: VisualKmlData | null;
  comparableRows?: VisualComparableRow[];
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const [baseLayer, setBaseLayer] = useState<"topo" | "imagery">("topo");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready">("loading");

  const subjectLonLat = useMemo(() => parseGps(fields?.gps), [fields?.gps]);
  const kmlLonLat = useMemo(() => kmlCoordinatesToLonLat(kmlData), [kmlData]);
  const maxComparableDistanceMiles = useMemo(
    () => getMaxComparableDistanceMiles(comparableRows),
    [comparableRows],
  );
  const hasMapAnchor = Boolean(subjectLonLat || kmlLonLat.length);
  const visibleComparableRows = (comparableRows ?? []).slice(0, 5);

  useEffect(() => {
    let isActive = true;

    async function renderMap() {
      if (!mapContainerRef.current) {
        return;
      }

      if (!hasMapAnchor) {
        return;
      }

      try {
        setLoadError(null);
        setMapStatus("loading");
        const ol = await loadOpenLayers();

        if (!isActive || !mapContainerRef.current) {
          return;
        }

        mapInstanceRef.current?.setTarget(undefined);

        const baseTileLayer = new ol.layer.Tile({
          source: new ol.source.XYZ({
            url: baseLayer === "topo" ? USGS_IMAGERY_TOPO_URL : USGS_IMAGERY_ONLY_URL,
            crossOrigin: "anonymous",
            maxZoom: 16,
            attributions: `${getMapAttributionLabel(baseLayer)} courtesy of USGS The National Map`,
          }),
        });

        const vectorSource = new ol.source.Vector();
        const centerLonLat = subjectLonLat || kmlLonLat[0] || DEFAULT_CENTER_LON_LAT;

        if (subjectLonLat && maxComparableDistanceMiles) {
          vectorSource.addFeature(
            new ol.Feature({
              geometry: new ol.geom.Circle(
                ol.proj.fromLonLat(subjectLonLat),
                maxComparableDistanceMiles * METERS_PER_MILE,
              ),
              name: "Comparable distance radius",
            }),
          );
        }

        if (kmlLonLat.length >= 3) {
          const projectedCoordinates = kmlLonLat.map((coordinate) => ol.proj.fromLonLat(coordinate));
          const first = projectedCoordinates[0];
          const last = projectedCoordinates[projectedCoordinates.length - 1];
          const closedCoordinates =
            first[0] === last[0] && first[1] === last[1]
              ? projectedCoordinates
              : [...projectedCoordinates, first];

          vectorSource.addFeature(
            new ol.Feature({
              geometry: new ol.geom.Polygon([closedCoordinates]),
              name: "Parcel boundary",
            }),
          );
        } else if (kmlLonLat.length === 2) {
          vectorSource.addFeature(
            new ol.Feature({
              geometry: new ol.geom.LineString(kmlLonLat.map((coordinate) => ol.proj.fromLonLat(coordinate))),
              name: "Parcel line",
            }),
          );
        }

        if (subjectLonLat) {
          vectorSource.addFeature(
            new ol.Feature({
              geometry: new ol.geom.Point(ol.proj.fromLonLat(subjectLonLat)),
              name: "Subject parcel",
            }),
          );
        }

        const vectorLayer = new ol.layer.Vector({
          source: vectorSource,
          style: (feature: any) => {
            const geometryType = feature.getGeometry()?.getType();

            if (geometryType === "Point") {
              return buildPointStyle(ol);
            }

            if (geometryType === "Circle") {
              return buildRadiusStyle(ol);
            }

            return buildPolygonStyle(ol);
          },
        });

        const view = new ol.View({
          center: ol.proj.fromLonLat(centerLonLat),
          zoom: subjectLonLat ? 14 : 11,
          minZoom: 3,
          maxZoom: 18,
        });

        const map = new ol.Map({
          target: mapContainerRef.current,
          layers: [baseTileLayer, vectorLayer],
          view,
        });

        if (vectorSource.getFeatures().length) {
          view.fit(vectorSource.getExtent(), {
            padding: [40, 40, 40, 40],
            maxZoom: kmlLonLat.length >= 3 ? 16 : 14,
          });
        }

        mapInstanceRef.current = map;

        requestAnimationFrame(() => {
          map.updateSize();
          if (isActive) {
            setMapStatus("ready");
          }
        });

        window.setTimeout(() => {
          map.updateSize();
        }, 250);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Map failed to load.");
      }
    }

    void renderMap();

    return () => {
      isActive = false;
      mapInstanceRef.current?.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, [baseLayer, comparableRows, hasMapAnchor, kmlLonLat, maxComparableDistanceMiles, subjectLonLat]);

  if (!hasMapAnchor) {
    return (
      <section className="callout-card simple-output-section">
        <div className="simple-section-head">
          <strong>USGS map</strong>
          <span className="muted-chip">No coordinates</span>
        </div>
        <p className="muted-copy">
          The captured parcel did not include GPS or KML coordinates yet, so the map cannot center on the
          property.
        </p>
      </section>
    );
  }

  return (
    <section className="callout-card simple-output-section map-card">
      <div className="simple-section-head map-card-head">
        <div>
          <strong>USGS parcel map</strong>
          <p className="muted-copy">
            No Mapbox key required. Parcel marker uses captured GPS; boundary appears when KML is attached.
          </p>
        </div>
        <div className="map-layer-toggle" aria-label="Map layer">
          <button
            className={baseLayer === "topo" ? "is-active" : ""}
            type="button"
            onClick={() => setBaseLayer("topo")}
          >
            Topo imagery
          </button>
          <button
            className={baseLayer === "imagery" ? "is-active" : ""}
            type="button"
            onClick={() => setBaseLayer("imagery")}
          >
            Imagery only
          </button>
        </div>
      </div>

      {loadError ? <p className="auth-error">{loadError}</p> : null}

      <div className="phase2-map-shell">
        <div ref={mapContainerRef} className="phase2-map" />
        {mapStatus === "loading" && !loadError ? (
          <div className="map-loading-panel">Loading USGS imagery...</div>
        ) : null}
        <div className="map-legend-panel">
          <span className="map-legend-item">
            <b className="legend-dot is-subject" /> Subject
          </span>
          <span className="map-legend-item">
            <b className="legend-line is-boundary" /> Boundary
          </span>
          <span className="map-legend-item">
            <b className="legend-line is-radius" /> Comp radius
          </span>
        </div>
      </div>

      <div className="map-fact-grid">
        <div>
          <span>GPS</span>
          <b>{fields?.gps || "Not captured"}</b>
        </div>
        <div>
          <span>Boundary</span>
          <b>{kmlLonLat.length >= 3 ? `${kmlLonLat.length} points` : "KML not attached"}</b>
        </div>
        <div>
          <span>Comp distance</span>
          <b>{maxComparableDistanceMiles ? `${maxComparableDistanceMiles.toFixed(2)} mi` : "Not captured"}</b>
        </div>
      </div>

      {visibleComparableRows.length ? (
        <details className="details-card map-comps-details">
          <summary>Captured comp rows</summary>
          <ul className="flat-list compact-list">
            {visibleComparableRows.map((row, index) => (
              <li key={`${index}-${row.listingUrl || row.city || "comp"}`}>
                {formatComparableRowSummary(row)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
