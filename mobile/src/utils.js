export function toCoordinate(point) {
  return {
    latitude: Number(point.lat),
    longitude: Number(point.lng)
  };
}

export function routeCoordinates(route) {
  return route?.geometry?.map(toCoordinate) || [];
}

export function formatDistance(km) {
  if (!Number.isFinite(km)) return '0 км';
  return `${km.toFixed(km >= 10 ? 0 : 1)} км`;
}

export function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return '0 мин';
  if (minutes < 60) return `${Math.round(minutes)} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `${hours} ч ${rest} мин`;
}

export function categoryLabel(category) {
  const labels = {
    traffic: 'ДТП / трафик',
    poor_lighting: 'Проблема с освещением',
    construction: 'Ремонт',
    crowd: 'Толпа',
    underpass: 'Подземный переход',
    slope: 'Уклон',
    incident: 'Событие'
  };
  return labels[category] || category;
}

