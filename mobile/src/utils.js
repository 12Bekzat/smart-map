export function toCoordinate(point) {
  return {
    latitude: Number(point.lat),
    longitude: Number(point.lng)
  };
}

export function routeCoordinates(route) {
  return route?.geometry?.map(toCoordinate) || [];
}

const units = {
  kk: { km: 'км', min: 'мин', hour: 'сағ' },
  ru: { km: 'км', min: 'мин', hour: 'ч' },
  en: { km: 'km', min: 'min', hour: 'h' },
  zh: { km: '公里', min: '分钟', hour: '小时', compact: true }
};

const categoryLabels = {
  kk: {
    traffic: 'ЖКО / трафик',
    poor_lighting: 'Жарық мәселесі',
    construction: 'Жөндеу',
    crowd: 'Адам көп',
    underpass: 'Жерасты өткелі',
    slope: 'Еңіс',
    incident: 'Оқиға'
  },
  ru: {
    traffic: 'ДТП / трафик',
    poor_lighting: 'Проблема с освещением',
    construction: 'Ремонт',
    crowd: 'Толпа',
    underpass: 'Подземный переход',
    slope: 'Уклон',
    incident: 'Событие'
  },
  en: {
    traffic: 'Crash / traffic',
    poor_lighting: 'Lighting problem',
    construction: 'Construction',
    crowd: 'Crowd',
    underpass: 'Underpass',
    slope: 'Slope',
    incident: 'Incident'
  },
  zh: {
    traffic: '事故 / 交通',
    poor_lighting: '照明问题',
    construction: '施工',
    crowd: '人群',
    underpass: '地下通道',
    slope: '坡道',
    incident: '事件'
  }
};

function getUnits(language) {
  return units[language] || units.ru;
}

export function formatDistance(km, language = 'ru') {
  const labels = getUnits(language);
  if (!Number.isFinite(km)) return labels.compact ? `0${labels.km}` : `0 ${labels.km}`;
  const value = km.toFixed(km >= 10 ? 0 : 1);
  return labels.compact ? `${value}${labels.km}` : `${value} ${labels.km}`;
}

export function formatDuration(minutes, language = 'ru') {
  const labels = getUnits(language);
  if (!Number.isFinite(minutes)) return labels.compact ? `0${labels.min}` : `0 ${labels.min}`;
  if (minutes < 60) {
    const value = Math.round(minutes);
    return labels.compact ? `${value}${labels.min}` : `${value} ${labels.min}`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return labels.compact
    ? `${hours}${labels.hour} ${rest}${labels.min}`
    : `${hours} ${labels.hour} ${rest} ${labels.min}`;
}

export function categoryLabel(category, language = 'ru') {
  const labels = categoryLabels[language] || categoryLabels.ru;
  return labels[category] || category;
}

