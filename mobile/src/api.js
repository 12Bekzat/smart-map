import { API_BASE_URL, API_FALLBACK_URLS } from './config';

async function request(path, options = {}) {
  const { token, timeoutMs = 9000, ...fetchOptions } = options;
  const baseUrls = [API_BASE_URL, ...API_FALLBACK_URLS];
  let lastNetworkError;
  const triedUrls = [];

  for (const baseUrl of baseUrls) {
    triedUrls.push(baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(fetchOptions.headers || {})
        },
        signal: controller.signal,
        ...fetchOptions
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'SafeWay API error');
      }
      return payload;
    } catch (error) {
      lastNetworkError = error;
      const message = String(error.message);
      if (
        error.name !== 'AbortError' &&
        !message.includes('Network request failed') &&
        !message.includes('Failed to fetch') &&
        !message.includes('fetch failed') &&
        !message.includes('connection is aborted') &&
        !message.includes('aborted')
      ) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`SafeWay API is unavailable: ${lastNetworkError?.message || 'network error'}. Tried: ${triedUrls.join(', ')}`);
}

export function fetchSafeRoute(body) {
  return request('/api/routes/safe', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 12000
  });
}

export function fetchRisks() {
  return request('/api/risks');
}

export function fetchReports() {
  return request('/api/reports');
}

export function fetchPlaces() {
  return request('/api/places');
}

export function fetchMapFeatures() {
  return request('/api/map/features');
}

export function searchPlaces(query) {
  return request(`/api/search?q=${encodeURIComponent(query)}`, { timeoutMs: 10000 });
}

export function sendReport(body, token) {
  return request('/api/reports', {
    method: 'POST',
    body: JSON.stringify(body),
    token
  });
}

export function registerUser(body) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function loginUser(body) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function fetchMe(token) {
  return request('/api/auth/me', { token });
}

export function saveRemotePreferences(settings, token) {
  return request('/api/auth/preferences', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
    token
  });
}
