const NIGHT_HOURS = new Set([20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6]);

export function scoreRoutes({ routes, risks, safeFeatures = [], profile, departureHour, avoid = [] }) {
  return routes
    .map((route) => {
      const riskHits = findRiskHits(route.geometry, risks, { departureHour, avoid });
      const safeHits = findSafeHits(route.geometry, safeFeatures);
      const distanceKm = route.distanceMeters / 1000;
      const durationMin = route.durationSeconds / 60;
      const penalty = riskHits.reduce((sum, hit) => sum + hit.penalty, 0);
      const safetyBoost = Math.min(16, safeHits.reduce((sum, hit) => sum + hit.boost, 0));
      const profilePenalty = profile === 'walk' ? 0 : Math.min(8, distanceKm * 0.28);
      const safetyScore = Math.max(1, Math.min(100, Math.round(100 - penalty - profilePenalty + safetyBoost)));

      return {
        ...route,
        safetyScore,
        riskHits,
        safeHits,
        summary: {
          distanceKm: round(distanceKm, 2),
          durationMin: Math.round(durationMin),
          riskCount: riskHits.length,
          safeCount: safeHits.length,
          safetyLabel: getSafetyLabel(safetyScore)
        }
      };
    })
    .sort((a, b) => {
      const scoreDiff = b.safetyScore - a.safetyScore;
      if (Math.abs(scoreDiff) > 6) return scoreDiff;
      return a.durationSeconds - b.durationSeconds;
    });
}

function findSafeHits(points, features) {
  const hits = new Map();

  for (const feature of features) {
    const geometry = Array.isArray(feature.geometry) ? feature.geometry : [];
    if (!geometry.length) continue;

    const nearest = Math.min(...geometry.map((point) => nearestDistanceToPolyline(points, point)));
    const threshold = Number(feature.radius_m || 120) + 100;
    if (nearest > threshold) continue;

    const proximityFactor = Math.max(0.2, 1 - nearest / threshold);
    const categoryBoost = feature.category === 'lit_street' ? 4.2 : feature.category === 'crowded_corridor' ? 3.6 : 3;
    const boost = round(categoryBoost * proximityFactor * (Number(feature.safety_score || 70) / 80), 1);

    hits.set(feature.id, {
      id: feature.id,
      title: feature.title,
      category: feature.category,
      distanceMeters: Math.round(nearest),
      boost,
      description: feature.description
    });
  }

  return [...hits.values()].sort((a, b) => b.boost - a.boost).slice(0, 6);
}

function findRiskHits(points, risks, { departureHour, avoid }) {
  const hits = new Map();
  const night = NIGHT_HOURS.has(Number(departureHour));

  for (const risk of risks) {
    const nearest = nearestDistanceToPolyline(points, risk);
    const threshold = risk.radius_m + 80;
    if (nearest > threshold) continue;

    const avoidMultiplier = avoid.includes(risk.category) ? 1.45 : 1;
    const nightMultiplier = night && risk.category === 'poor_lighting' ? 1.55 : 1;
    const proximityFactor = Math.max(0.25, 1 - nearest / threshold);
    const penalty = round(risk.severity * 5.5 * proximityFactor * avoidMultiplier * nightMultiplier, 1);

    hits.set(risk.id, {
      id: risk.id,
      title: risk.title,
      category: risk.category,
      severity: risk.severity,
      distanceMeters: Math.round(nearest),
      penalty,
      description: risk.description
    });
  }

  return [...hits.values()].sort((a, b) => b.penalty - a.penalty).slice(0, 6);
}

function nearestDistanceToPolyline(points, risk) {
  return points.reduce((min, point) => {
    const distance = haversine(point, { lat: risk.lat, lng: risk.lng });
    return Math.min(min, distance);
  }, Number.POSITIVE_INFINITY);
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

function getSafetyLabel(score) {
  if (score >= 85) return 'Очень безопасно';
  if (score >= 70) return 'Безопасно';
  if (score >= 50) return 'Средний риск';
  return 'Лучше выбрать другой путь';
}

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
