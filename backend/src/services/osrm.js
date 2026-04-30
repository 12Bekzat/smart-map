const PROFILE_MAP = {
  walk: 'foot',
  drive: 'driving',
  bike: 'bike',
  scooter: 'bike'
};

const routeCache = new Map();
const CACHE_TTL_MS = Number(process.env.OSRM_CACHE_TTL_MS || 60_000);
const OSRM_TIMEOUT_MS = Number(process.env.OSRM_TIMEOUT_MS || 2200);

export async function getOsrmRoutes({ start, end, profile }) {
  const osrmProfile = PROFILE_MAP[profile] || PROFILE_MAP.walk;
  const baseUrl = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url = `${baseUrl}/route/v1/${osrmProfile}/${coordinates}?alternatives=true&overview=full&geometries=geojson&steps=false`;
  const cacheKey = `${osrmProfile}:${coordinates}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.routes;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'SafeWay-Almaty/1.0' },
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`OSRM timed out after ${OSRM_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `OSRM returned ${response.status}`);
  }
  if (payload.code !== 'Ok' || !payload.routes?.length) {
    throw new Error(payload.message || 'OSRM route was not found');
  }

  const routes = payload.routes.map((route, index) => ({
    id: `osrm-${index + 1}`,
    source: 'osrm',
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    steps: route.legs?.flatMap((leg) => leg.steps || []).map((step) => ({
      name: step.name || 'Без названия',
      instruction: step.maneuver?.type || 'continue',
      distanceMeters: step.distance,
      durationSeconds: step.duration,
      location: {
        lat: step.maneuver.location[1],
        lng: step.maneuver.location[0]
      }
    })) || []
  }));

  routeCache.set(cacheKey, { createdAt: Date.now(), routes });
  return routes;
}

export async function getOsrmRouteThroughWaypoints({ waypoints, profile }) {
  const osrmProfile = PROFILE_MAP[profile] || PROFILE_MAP.walk;
  const baseUrl = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
  const coordinates = waypoints.map((point) => `${point.lng},${point.lat}`).join(';');
  const url = `${baseUrl}/route/v1/${osrmProfile}/${coordinates}?alternatives=false&overview=full&geometries=geojson&steps=false`;
  const cacheKey = `${osrmProfile}:through:${coordinates}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.routes;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'SafeWay-Almaty/1.0' },
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`OSRM timed out after ${OSRM_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `OSRM returned ${response.status}`);
  }
  if (payload.code !== 'Ok' || !payload.routes?.length) {
    throw new Error(payload.message || 'OSRM route was not found');
  }

  const routes = payload.routes.map((route, index) => ({
    id: `osrm-through-${index + 1}`,
    source: 'osrm',
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    steps: []
  }));

  routeCache.set(cacheKey, { createdAt: Date.now(), routes });
  return routes;
}

export function getFallbackRoute({ start, end, profile = 'walk' }) {
  const mid = {
    lat: (start.lat + end.lat) / 2 + 0.006,
    lng: (start.lng + end.lng) / 2 - 0.004
  };
  const geometry = [start, mid, end];
  const distanceMeters = estimatePolylineDistance(geometry);

  return [{
    id: 'fallback-1',
    source: 'fallback',
    distanceMeters,
    durationSeconds: Math.round(distanceMeters / getFallbackSpeed(profile)),
    geometry,
    steps: []
  }];
}

export function combineRouteLegs(legs, id = 'combined-1') {
  const geometry = legs.flatMap((leg, index) => index === 0 ? leg.geometry : leg.geometry.slice(1));
  return {
    id,
    source: legs.some((leg) => leg.source === 'fallback') ? 'mixed' : 'osrm',
    distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    geometry,
    steps: legs.flatMap((leg) => leg.steps || [])
  };
}

function getFallbackSpeed(profile) {
  if (profile === 'bike') return 4.2;
  if (profile === 'scooter') return 5.2;
  if (profile === 'drive') return 8.5;
  return 1.25;
}

function estimatePolylineDistance(points) {
  return points.slice(1).reduce((sum, point, index) => sum + haversine(points[index], point), 0);
}

function haversine(a, b) {
  const radius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * radius * Math.asin(Math.sqrt(h));
}
