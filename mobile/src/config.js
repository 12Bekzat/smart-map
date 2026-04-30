export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
export const API_FALLBACK_URLS = [
  ...(process.env.EXPO_PUBLIC_API_FALLBACK_URLS || '').split(',').map((url) => url.trim()).filter(Boolean),
  'http://10.0.2.2:4000',
  'http://192.168.0.102:4000',
  'http://172.20.10.4:4000',
].filter((url, index, urls) => url && url !== API_BASE_URL && urls.indexOf(url) === index);

export const ALMATY_REGION = {
  latitude: 43.2389,
  longitude: 76.8897,
  latitudeDelta: 0.16,
  longitudeDelta: 0.16
};

export const DEFAULT_START = {
  title: 'Метро Алмалы',
  lat: 43.2495,
  lng: 76.9459
};

export const DEFAULT_END = {
  title: 'Dostyk Plaza',
  lat: 43.2341,
  lng: 76.9583
};
