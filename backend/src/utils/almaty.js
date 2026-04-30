export const ALMATY_BOUNDS = {
  minLat: 43.12,
  maxLat: 43.39,
  minLng: 76.78,
  maxLng: 77.12
};

export const ALMATY_CENTER = {
  lat: 43.2389,
  lng: 76.8897
};

export function isInsideAlmaty(point) {
  return (
    point.lat >= ALMATY_BOUNDS.minLat &&
    point.lat <= ALMATY_BOUNDS.maxLat &&
    point.lng >= ALMATY_BOUNDS.minLng &&
    point.lng <= ALMATY_BOUNDS.maxLng
  );
}

export function assertInsideAlmaty(point, label) {
  if (!isInsideAlmaty(point)) {
    const error = new Error(`${label} must be inside Almaty service area`);
    error.status = 400;
    throw error;
  }
}

