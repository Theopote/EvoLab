import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSuggestedOutline,
  latLonToLocal,
  normalizeSiteCoordinates,
  translatePolygon
} from "@/lib/site-projection";
import type { SiteAddress, SiteBuildingFootprint, SiteContext, SiteRoadSegment, TerrainSample } from "@/lib/site-types";
import type { Point } from "@/lib/project-types";

const FetchSiteRequestSchema = z.object({
  address: z.string().min(3),
  radiusMeters: z.number().min(50).max(500).default(180)
});

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface OverpassElement {
  id: number;
  type: "way" | "node";
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

function estimateBuildingHeight(tags: Record<string, string> | undefined) {
  const levels = Number(tags?.["building:levels"] ?? tags?.levels ?? 0);
  const height = Number(tags?.height ?? 0);

  if (height > 0) {
    return height;
  }

  if (levels > 0) {
    return levels * 3.2;
  }

  if (tags?.building === "apartments" || tags?.building === "commercial") {
    return 18;
  }

  return 9;
}

async function geocodeAddress(query: string): Promise<SiteAddress | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "EvoLab/0.1 (site-context-fetch)"
    },
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    return null;
  }

  const results = (await response.json()) as NominatimResult[];

  if (!results.length) {
    return null;
  }

  const [result] = results;

  return {
    query,
    displayName: result.display_name,
    lat: Number(result.lat),
    lon: Number(result.lon)
  };
}

async function fetchOverpassContext(lat: number, lon: number, radiusMeters: number) {
  const query = `
    [out:json][timeout:25];
    (
      way["building"](around:${radiusMeters},${lat},${lon});
      way["highway"~"^(primary|secondary|tertiary|residential|living_street|footway|service)$"](around:${radiusMeters},${lat},${lon});
    );
    out geom;
  `;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    return { buildings: [] as SiteBuildingFootprint[], roads: [] as SiteRoadSegment[] };
  }

  const payload = (await response.json()) as { elements: OverpassElement[] };
  const buildings: SiteBuildingFootprint[] = [];
  const roads: SiteRoadSegment[] = [];

  payload.elements.forEach((element) => {
    if (!element.geometry?.length) {
      return;
    }

    const points = element.geometry.map((node) => latLonToLocal(node.lat, node.lon, lat, lon));

    if (element.tags?.building) {
      buildings.push({
        id: `osm-building-${element.id}`,
        name: element.tags.name,
        heightMeters: estimateBuildingHeight(element.tags),
        polygon: points
      });
      return;
    }

    if (element.tags?.highway) {
      roads.push({
        id: `osm-road-${element.id}`,
        name: element.tags.name,
        kind: element.tags.highway,
        points
      });
    }
  });

  return { buildings, roads };
}

async function fetchTerrainGrid(lat: number, lon: number, radiusMeters: number, grid = 5): Promise<TerrainSample[]> {
  const step = (radiusMeters * 2) / (grid - 1);
  const samples: Array<{ lat: number; lon: number; x: number; y: number }> = [];

  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const x = -radiusMeters + col * step;
      const y = -radiusMeters + row * step;
      const latOffset = y / 111_320;
      const lonOffset = x / (111_320 * Math.cos((lat * Math.PI) / 180));
      samples.push({ lat: lat + latOffset, lon: lon + lonOffset, x, y });
    }
  }

  const locations = samples.map((sample) => `${sample.lat},${sample.lon}`).join("|");
  const response = await fetch(`https://api.opentopodata.org/v1/aster30m?locations=${locations}`, {
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    return samples.map((sample) => ({ x: sample.x, y: sample.y, elevationMeters: 0 }));
  }

  const payload = (await response.json()) as {
    results: Array<{ elevation: number | null }>;
  };

  return samples.map((sample, index) => ({
    x: sample.x,
    y: sample.y,
    elevationMeters: payload.results[index]?.elevation ?? 0
  }));
}

function createMockSiteContext(address: SiteAddress, radiusMeters: number): SiteContext {
  const buildings: SiteBuildingFootprint[] = [
    {
      id: "mock-north",
      name: "North block",
      heightMeters: 21,
      polygon: [
        [-40, 60],
        [10, 60],
        [10, 95],
        [-40, 95]
      ]
    },
    {
      id: "mock-east",
      name: "East block",
      heightMeters: 15,
      polygon: [
        [70, -10],
        [110, -10],
        [110, 40],
        [70, 40]
      ]
    }
  ];
  const roads: SiteRoadSegment[] = [
    {
      id: "mock-main-road",
      name: "Main road",
      kind: "secondary",
      points: [
        [-80, 0],
        [120, 0]
      ]
    }
  ];
  const terrain: TerrainSample[] = Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    return {
      x: -radiusMeters + col * (radiusMeters / 2),
      y: -radiusMeters + row * (radiusMeters / 2),
      elevationMeters: Math.sin(col * 0.8) * 2 + Math.cos(row * 0.6) * 1.5
    };
  });
  const suggestedOutline = createSuggestedOutline(72, 42);
  const { offsetX, offsetY } = normalizeSiteCoordinates(buildings, roads, terrain);

  return {
    address,
    radiusMeters,
    origin: address,
    suggestedOutline,
    buildings: buildings.map((building) => ({
      ...building,
      polygon: translatePolygon(building.polygon, offsetX, offsetY)
    })),
    roads: roads.map((road) => ({
      ...road,
      points: translatePolygon(road.points, offsetX, offsetY)
    })),
    terrain: terrain.map((sample) => ({
      ...sample,
      x: sample.x + offsetX,
      y: sample.y + offsetY
    })),
    fetchedAt: new Date().toISOString(),
    source: "mock"
  };
}

export async function POST(request: Request) {
  const parsed = FetchSiteRequestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { address, radiusMeters } = parsed.data;

  try {
    const geocoded = await geocodeAddress(address);

    if (!geocoded) {
      return NextResponse.json({ error: "Address not found." }, { status: 404 });
    }

    const [overpass, terrain] = await Promise.all([
      fetchOverpassContext(geocoded.lat, geocoded.lon, radiusMeters),
      fetchTerrainGrid(geocoded.lat, geocoded.lon, radiusMeters)
    ]);

    const suggestedOutline = createSuggestedOutline(72, 42);
    const { offsetX, offsetY } = normalizeSiteCoordinates(overpass.buildings, overpass.roads, terrain);
    const context: SiteContext = {
      address: geocoded,
      radiusMeters,
      origin: geocoded,
      suggestedOutline,
      buildings: overpass.buildings.map((building) => ({
        ...building,
        polygon: translatePolygon(building.polygon, offsetX, offsetY)
      })),
      roads: overpass.roads.map((road) => ({
        ...road,
        points: translatePolygon(road.points, offsetX, offsetY)
      })),
      terrain: terrain.map((sample) => ({
        ...sample,
        x: sample.x + offsetX,
        y: sample.y + offsetY
      })),
      fetchedAt: new Date().toISOString(),
      source: "openstreetmap"
    };

    return NextResponse.json({ context });
  } catch (error) {
    const fallbackAddress: SiteAddress = {
      query: address,
      displayName: address,
      lat: 31.2304,
      lon: 121.4737
    };

    return NextResponse.json({
      context: createMockSiteContext(fallbackAddress, radiusMeters),
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to fetch live GIS context."
    });
  }
}
