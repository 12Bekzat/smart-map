import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const searchRouter = Router();

const searchSchema = z.object({
  q: z.string().trim().min(2).max(120)
});

const streetCatalog = [
  {
    id: 'street:abay',
    title: 'Проспект Абая',
    subtitle: 'Освещенный центральный коридор',
    category: 'street',
    lat: 43.2422,
    lng: 76.9455,
    aliases: ['абая', 'абай', 'abay', 'abai', 'проспект абая', 'абай даңғылы']
  },
  {
    id: 'street:dostyk',
    title: 'Проспект Достык',
    subtitle: 'Активная улица с магазинами и безопасными местами',
    category: 'street',
    lat: 43.2396,
    lng: 76.9557,
    aliases: ['достык', 'достық', 'dostyk', 'dostyq', 'проспект достык', 'достық даңғылы']
  },
  {
    id: 'street:nazarbayev',
    title: 'Проспект Назарбаева',
    subtitle: 'Центральная освещенная улица',
    category: 'street',
    lat: 43.2422,
    lng: 76.9455,
    aliases: ['назарбаева', 'назарбаев', 'nazarbayev', 'nazarbaev', 'назарбаев даңғылы']
  },
  {
    id: 'street:panfilov',
    title: 'Улица Панфилова',
    subtitle: 'Пешеходная зона с людным потоком',
    category: 'street',
    lat: 43.2543,
    lng: 76.9496,
    aliases: ['панфилова', 'панфилов', 'panfilov', 'panfilova']
  },
  {
    id: 'street:tole-bi',
    title: 'Улица Толе би',
    subtitle: 'Городская магистраль с участками ремонта',
    category: 'street',
    lat: 43.2418,
    lng: 76.8995,
    aliases: ['толе би', 'толе', 'tole bi', 'tole']
  },
  {
    id: 'street:raiyimbek',
    title: 'Проспект Райымбека',
    subtitle: 'Транспортный коридор, ночью лучше держаться освещенных участков',
    category: 'street',
    lat: 43.2715,
    lng: 76.9436,
    aliases: ['райымбека', 'райымбек', 'раимбек', 'raiymbek', 'rayimbek']
  },
  {
    id: 'street:rozybakiev',
    title: 'Улица Розыбакиева',
    subtitle: 'Западный городской коридор',
    category: 'street',
    lat: 43.2418,
    lng: 76.8995,
    aliases: ['розыбакиева', 'розыбакиев', 'rozybakiev', 'rozybakieva']
  },
  {
    id: 'street:al-farabi',
    title: 'Проспект Аль-Фараби',
    subtitle: 'Широкая магистраль на юге города',
    category: 'street',
    lat: 43.2186,
    lng: 76.9286,
    aliases: ['аль фараби', 'аль-фараби', 'al farabi', 'al-farabi', 'farabi']
  },
  {
    id: 'street:seifullin',
    title: 'Проспект Сейфуллина',
    subtitle: 'Север-юг через центр Алматы',
    category: 'street',
    lat: 43.2574,
    lng: 76.9351,
    aliases: ['сейфуллина', 'сейфуллин', 'seifullin', 'seyfullin']
  },
  {
    id: 'street:satpaev',
    title: 'Улица Сатпаева',
    subtitle: 'Центральная улица Бостандыкского района',
    category: 'street',
    lat: 43.2364,
    lng: 76.9278,
    aliases: ['сатпаева', 'сатпаев', 'satpaev', 'satpayev']
  },
  {
    id: 'street:baitursynov',
    title: 'Улица Байтурсынова',
    subtitle: 'Городской коридор через центр Алматы',
    category: 'street',
    lat: 43.2421,
    lng: 76.9274,
    aliases: ['байтурсынова', 'байтурсынов', 'байтурсынұлы', 'baitursynov', 'baytursynov']
  },
  {
    id: 'street:zhunisov',
    title: 'Улица Жунисова',
    subtitle: 'Улица в Наурызбайском районе',
    category: 'street',
    lat: 43.2219,
    lng: 76.7887,
    aliases: ['жунисова', 'жунисов', 'zhunisov', 'zhunisova']
  },
  {
    id: 'street:zhibek-zholy',
    title: 'Проспект Жибек Жолы',
    subtitle: 'Пешеходный Арбат и центральная улица',
    category: 'street',
    lat: 43.2617,
    lng: 76.9457,
    aliases: ['жибек жолы', 'арбат', 'zhibek zholy', 'zhibek', 'arbat']
  }
];

const aliasGroups = streetCatalog.map((item) => item.aliases);

searchRouter.get('/', asyncHandler(async (req, res) => {
  const { q } = searchSchema.parse(req.query);
  const terms = expandSearchTerms(q);
  const patterns = terms.map((term) => `%${term}%`);

  const [places, features, risks, nominatimResults, overpassResults] = await Promise.all([
    pool.query(`
      SELECT id, title, type AS category, address, lat, lng
      FROM safe_places
      WHERE title ILIKE ANY($1::text[]) OR address ILIKE ANY($1::text[]) OR type ILIKE ANY($1::text[])
      ORDER BY title ASC
      LIMIT 8
    `, [patterns]),
    pool.query(`
      SELECT id, title, category, description, geometry
      FROM map_features
      WHERE active = true
        AND (title ILIKE ANY($1::text[]) OR description ILIKE ANY($1::text[]) OR category ILIKE ANY($1::text[]))
      ORDER BY safety_score DESC, title ASC
      LIMIT 8
    `, [patterns]),
    pool.query(`
      SELECT id, title, category, description, lat, lng
      FROM risk_zones
      WHERE active = true
        AND (title ILIKE ANY($1::text[]) OR description ILIKE ANY($1::text[]) OR category ILIKE ANY($1::text[]))
      ORDER BY severity DESC, title ASC
      LIMIT 5
    `, [patterns]),
    searchNominatim(q),
    searchOverpass(q, terms)
  ]);

  const results = [
    ...getStreetResults(q),
    ...places.rows.map((place) => ({
      id: `place:${place.id}`,
      source: 'safe_place',
      title: place.title,
      subtitle: place.address || place.category,
      category: place.category,
      lat: Number(place.lat),
      lng: Number(place.lng)
    })),
    ...nominatimResults,
    ...features.rows.map((feature) => {
      const point = getFeaturePoint(feature.geometry);
      return {
        id: `feature:${feature.id}`,
        source: 'map_feature',
        title: feature.title,
        subtitle: feature.description || feature.category,
        category: feature.category,
        lat: point.lat,
        lng: point.lng
      };
    }),
    ...risks.rows.map((risk) => ({
      id: `risk:${risk.id}`,
      source: 'risk_zone',
      title: risk.title,
      subtitle: risk.description || risk.category,
      category: risk.category,
      lat: Number(risk.lat),
      lng: Number(risk.lng)
    })),
    ...overpassResults
  ];

  res.json({ results: dedupeResults(results).slice(0, 15) });
}));

async function searchOverpass(query, terms) {
  const safeTerms = terms
    .map((term) => normalize(term))
    .filter((term) => term.length >= 2)
    .slice(0, 5);

  if (!safeTerms.length) return [];

  const regex = safeTerms.map(escapeOverpassRegex).join('|');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  const body = `
    [out:json][timeout:4];
    (
      node["name"~"${regex}",i](43.12,76.78,43.39,77.12);
      way["name"~"${regex}",i](43.12,76.78,43.39,77.12);
      relation["name"~"${regex}",i](43.12,76.78,43.39,77.12);
    );
    out center tags 20;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'User-Agent': 'SafeWay-Almaty/1.0'
      },
      body,
      signal: controller.signal
    });

    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.elements || [])
      .map((element) => {
        const lat = element.lat ?? element.center?.lat;
        const lng = element.lon ?? element.center?.lon;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const title = element.tags?.name;
        if (!title) return null;
        return {
          id: `osm:${element.type}:${element.id}`,
          source: 'osm',
          title,
          subtitle: getOsmSubtitle(element.tags),
          category: element.tags?.highway ? 'street' : element.tags?.amenity || element.tags?.shop || 'osm',
          lat: Number(lat),
          lng: Number(lng)
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function searchNominatim(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  const params = new URLSearchParams({
    q: `${query}, Алматы, Казахстан`,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '10',
    bounded: '1',
    viewbox: '76.78,43.39,77.12,43.12',
    'accept-language': 'ru'
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'SafeWay-Almaty/1.0 (local-dev)',
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) return [];
    const payload = await response.json();
    return (Array.isArray(payload) ? payload : [])
      .map((item) => {
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        if (!isInsideAlmaty({ lat, lng })) return null;
        return {
          id: `nominatim:${item.osm_type}:${item.osm_id}`,
          source: 'osm_geocode',
          title: getNominatimTitle(item),
          subtitle: getNominatimSubtitle(item),
          category: getNominatimCategory(item),
          lat,
          lng
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function getOsmSubtitle(tags = {}) {
  if (tags.highway) return 'OpenStreetMap улица';
  if (tags.amenity) return `OpenStreetMap: ${tags.amenity}`;
  if (tags.shop) return `OpenStreetMap: ${tags.shop}`;
  if (tags.public_transport) return 'OpenStreetMap транспорт';
  return 'OpenStreetMap';
}

function escapeOverpassRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expandSearchTerms(query) {
  const normalized = normalize(query);
  const terms = new Set([query, normalized]);

  for (const group of aliasGroups) {
    const matched = group.some((alias) => {
      const value = normalize(alias);
      return value.includes(normalized) || normalized.includes(value);
    });
    if (matched) {
      group.forEach((alias) => terms.add(alias));
    }
  }

  return [...terms].filter(Boolean);
}

function getStreetResults(query) {
  const normalized = normalize(query);
  return streetCatalog
    .filter((street) => street.aliases.some((alias) => normalize(alias).includes(normalized) || normalized.includes(normalize(alias))))
    .map((street) => ({
      id: street.id,
      source: 'street',
      title: street.title,
      subtitle: street.subtitle,
      category: street.category,
      lat: street.lat,
      lng: street.lng
    }));
}

function dedupeResults(results) {
  const seen = new Set();
  return results.filter((item) => {
    const key = `${normalize(item.title)}:${Number(item.lat).toFixed(4)}:${Number(item.lng).toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/і/g, 'и')
    .replace(/ң/g, 'н')
    .replace(/ғ/g, 'г')
    .replace(/қ/g, 'к')
    .replace(/ү/g, 'у')
    .replace(/ұ/g, 'у')
    .replace(/һ/g, 'х');
}

function getFeaturePoint(geometry = []) {
  const points = Array.isArray(geometry) ? geometry : [];
  if (!points.length) return { lat: 43.2389, lng: 76.8897 };
  const middle = points[Math.floor(points.length / 2)];
  return { lat: Number(middle.lat), lng: Number(middle.lng) };
}

function getNominatimTitle(item) {
  const address = item.address || {};
  return (
    item.name ||
    address.amenity ||
    address.shop ||
    address.tourism ||
    address.leisure ||
    address.aeroway ||
    address.industrial ||
    address.neighbourhood ||
    address.suburb ||
    address.road ||
    address.pedestrian ||
    address.footway ||
    String(item.display_name || '').split(',')[0]
  );
}

function getNominatimSubtitle(item) {
  return String(item.display_name || '')
    .split(',')
    .slice(0, 4)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ') || 'OpenStreetMap';
}

function getNominatimCategory(item) {
  const address = item.address || {};
  if (item.category === 'shop') return item.type || 'shop';
  if (item.category === 'amenity') return item.type || 'amenity';
  if (item.category === 'aeroway') return item.type || 'airport';
  if (address.shop) return 'shop';
  if (address.amenity) return 'amenity';
  if (address.aeroway) return 'airport';
  if (item.category === 'highway') return 'street';
  if (address.road || address.pedestrian || address.footway) return 'street';
  return item.type || item.category || 'place';
}

function isInsideAlmaty(point) {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= 43.12 &&
    point.lat <= 43.39 &&
    point.lng >= 76.78 &&
    point.lng <= 77.12
  );
}
