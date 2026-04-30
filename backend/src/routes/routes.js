import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { combineRouteLegs, getFallbackRoute, getOsrmRouteThroughWaypoints, getOsrmRoutes } from '../services/osrm.js';
import { scoreRoutes } from '../services/safetyScoring.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertInsideAlmaty } from '../utils/almaty.js';

export const routeRouter = Router();

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

const routeSchema = z.object({
  start: pointSchema,
  end: pointSchema,
  waypoints: z.array(pointSchema.extend({ title: z.string().optional() })).min(2).max(6).optional(),
  profile: z.enum(['walk', 'drive', 'bike', 'scooter']).default('walk'),
  avoid: z.array(z.enum(['traffic', 'poor_lighting', 'construction', 'crowd', 'underpass', 'slope', 'incident'])).default([]),
  departureHour: z.number().int().min(0).max(23).optional()
});

routeRouter.post('/safe', asyncHandler(async (req, res) => {
  const parsed = routeSchema.parse(req.body);
  const body = {
    ...parsed,
    departureHour: parsed.departureHour ?? new Date().getHours()
  };
  const waypoints = body.waypoints?.length ? body.waypoints : [body.start, body.end];
  waypoints.forEach((point, index) => assertInsideAlmaty(point, `Waypoint ${index + 1}`));

  const [risks, safeFeatures] = await Promise.all([getRisks(), getSafeFeatures()]);
  let rawRoutes = [];
  let fallbackReason = null;

  if (waypoints.length === 2) {
    try {
      rawRoutes = await getOsrmRoutes({ start: waypoints[0], end: waypoints[1], profile: body.profile });
    } catch (error) {
      fallbackReason = error.message;
      rawRoutes = getFallbackRoute({ start: waypoints[0], end: waypoints[1], profile: body.profile });
    }
  } else {
    try {
      rawRoutes = await getOsrmRouteThroughWaypoints({ waypoints, profile: body.profile });
    } catch (error) {
      fallbackReason = error.message;
      const legResults = await Promise.all(waypoints.slice(0, -1).map(async (point, index) => {
        const nextPoint = waypoints[index + 1];
        try {
          const [leg] = await getOsrmRoutes({ start: point, end: nextPoint, profile: body.profile });
          return { leg };
        } catch (legError) {
          return {
            leg: getFallbackRoute({ start: point, end: nextPoint, profile: body.profile })[0],
            fallbackReason: legError.message
          };
        }
      }));
      const legs = legResults.map((result) => result.leg);
      fallbackReason = legResults.find((result) => result.fallbackReason)?.fallbackReason || fallbackReason;
      rawRoutes = [combineRouteLegs(legs)];
    }
  }

  const scored = scoreRoutes({
    routes: rawRoutes,
    risks,
    safeFeatures,
    profile: body.profile,
    departureHour: body.departureHour,
    avoid: body.avoid
  });

  res.json({
    recommended: scored[0],
    alternatives: scored.slice(1),
    meta: {
      serviceArea: 'Almaty, Kazakhstan',
      profile: body.profile,
      departureHour: body.departureHour,
      waypointCount: waypoints.length,
      fallback: Boolean(fallbackReason),
      fallbackReason
    }
  });
}));

async function getRisks() {
  const result = await pool.query(`
    SELECT id::text, title, category, severity, radius_m, description, lat, lng
    FROM risk_zones
    WHERE active = true
    UNION ALL
    SELECT
      ('report:' || id)::text AS id,
      CASE
        WHEN category = 'traffic' THEN 'User report: traffic or accident'
        WHEN category = 'poor_lighting' THEN 'User report: lighting problem'
        WHEN category = 'construction' THEN 'User report: construction'
        WHEN category = 'crowd' THEN 'User report: crowd'
        WHEN category = 'underpass' THEN 'User report: underpass'
        ELSE 'User report: incident'
      END AS title,
      category,
      severity,
      170 AS radius_m,
      description,
      lat,
      lng
    FROM user_reports
    WHERE status IN ('pending', 'verified')
  `);
  return result.rows.map((row) => ({
    ...row,
    lat: Number(row.lat),
    lng: Number(row.lng),
    severity: Number(row.severity),
    radius_m: Number(row.radius_m)
  }));
}

async function getSafeFeatures() {
  const result = await pool.query(`
    SELECT id, title, category, description, safety_score, radius_m, geometry
    FROM map_features
    WHERE active = true
      AND category IN ('lit_street', 'crowded_corridor', 'safe_zone', 'transport_hub')
  `);
  return result.rows;
}
