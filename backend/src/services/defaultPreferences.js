export const defaultPreferences = {
  profile: 'walk',
  avoid: ['poor_lighting', 'underpass'],
  nightRoute: false,
  preferLitStreets: true,
  preferPublicPlaces: true,
  maxRiskLevel: 3,
  routePriority: 'balanced',
  shareReports: true
};

export function mergePreferences(settings = {}) {
  return {
    ...defaultPreferences,
    ...settings,
    avoid: Array.isArray(settings.avoid) ? settings.avoid : defaultPreferences.avoid
  };
}

