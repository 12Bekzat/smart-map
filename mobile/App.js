import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchMe,
  fetchMapFeatures,
  fetchPlaces,
  fetchReports,
  fetchRisks,
  fetchSafeRoute,
  loginUser,
  registerUser,
  saveRemotePreferences,
  searchPlaces,
  sendReport
} from './src/api';
import { ALMATY_REGION, DEFAULT_END, DEFAULT_START } from './src/config';
import { LANGUAGE_OPTIONS, translate } from './src/i18n';
import { colors, shadows } from './src/theme';
import { categoryLabel, formatDistance, formatDuration, routeCoordinates, toCoordinate } from './src/utils';

const BASE_TILE_URL = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
const STORAGE_KEYS = {
  token: 'safeway.token',
  user: 'safeway.user',
  guestPreferences: 'safeway.guestPreferences',
  phoneSettings: 'safeway.phoneSettings',
  favorites: 'safeway.favorites'
};

const defaultPreferences = {
  profile: 'walk',
  avoid: ['poor_lighting', 'underpass'],
  nightRoute: false,
  preferLitStreets: true,
  preferPublicPlaces: true,
  maxRiskLevel: 3,
  routePriority: 'balanced',
  shareReports: true
};

const profiles = [
  { key: 'scooter', labelKey: 'profile.scooter', icon: 'flash' },
  { key: 'walk', labelKey: 'profile.walk', icon: 'walk' },
  { key: 'drive', labelKey: 'profile.drive', icon: 'car-sport' },
  { key: 'bike', labelKey: 'profile.bike', icon: 'bicycle' }
];

const avoidOptions = [
  { key: 'poor_lighting', labelKey: 'avoid.poor_lighting' },
  { key: 'underpass', labelKey: 'avoid.underpass' },
  { key: 'traffic', labelKey: 'avoid.traffic' },
  { key: 'crowd', labelKey: 'avoid.crowd' },
  { key: 'construction', labelKey: 'avoid.construction' },
  { key: 'slope', labelKey: 'avoid.slope' }
];

const priorities = [
  { key: 'safest', labelKey: 'priority.safest' },
  { key: 'balanced', labelKey: 'priority.balanced' },
  { key: 'fastest', labelKey: 'priority.fastest' }
];

const defaultPhoneSettings = {
  model: 'Samsung S22 Ultra',
  language: 'ru',
  navigationMode: 'buttons',
  bottomGuard: 44,
  compactRouteCard: false,
  largeTouchTargets: true
};

const navigationModes = [
  { key: 'buttons', labelKey: 'nav.buttons' },
  { key: 'gestures', labelKey: 'nav.gestures' }
];

const bottomGuardLevels = [
  { key: 28, labelKey: 'bottom.small' },
  { key: 44, labelKey: 'bottom.s22' },
  { key: 58, labelKey: 'bottom.large' }
];

const ALMATY_BOUNDS = {
  minLat: 43.12,
  maxLat: 43.39,
  minLng: 76.78,
  maxLng: 77.12
};

const layerConfig = {
  lit_street: { labelKey: 'layer.lit_street', color: '#F4B63E', icon: 'sunny' },
  crowded_corridor: { labelKey: 'layer.crowded_corridor', color: '#7C3AED', icon: 'people' },
  safe_zone: { labelKey: 'layer.safe_zone', color: '#16A34A', icon: 'shield-checkmark' },
  transport_hub: { labelKey: 'layer.transport_hub', color: '#0284C7', icon: 'train' },
  police: { labelKey: 'layer.police', color: '#1D4ED8', icon: 'shield' },
  hospital: { labelKey: 'layer.hospital', color: '#DC2626', icon: 'medical' }
};

function getBottomGuard(phoneSettings, insets) {
  const settings = { ...defaultPhoneSettings, ...(phoneSettings || {}) };
  const manualGuard = settings.navigationMode === 'buttons' ? settings.bottomGuard : 16;
  return Math.max(insets.bottom, manualGuard);
}

function usePhoneLayout(phoneSettings) {
  const insets = useSafeAreaInsets();
  const bottomGuard = getBottomGuard(phoneSettings, insets);

  return {
    bottomGuard,
    tabBottom: bottomGuard + 10,
    panelBottom: bottomGuard + 84,
    pageBottomPadding: bottomGuard + 98,
    sheetBottomPadding: bottomGuard + 18
  };
}

export default function App() {
  const mapRef = useRef(null);
  const searchRequestRef = useRef(0);
  const routeRequestRef = useRef(0);
  const navigationWatcherRef = useRef(null);
  const [screen, setScreen] = useState('map');
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [route, setRoute] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [routePanelHidden, setRoutePanelHidden] = useState(false);
  const [navigationActive, setNavigationActive] = useState(false);
  const [currentNavigationPoint, setCurrentNavigationPoint] = useState(null);
  const [risks, setRisks] = useState([]);
  const [reports, setReports] = useState([]);
  const [places, setPlaces] = useState([]);
  const [mapFeatures, setMapFeatures] = useState([]);
  const [routePoints, setRoutePoints] = useState([DEFAULT_START, DEFAULT_END]);
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState({
    lit_street: false,
    crowded_corridor: false,
    safe_zone: false,
    transport_hub: false,
    police: false,
    hospital: false,
    reports: true,
    risks: false,
    places: false
  });
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportPoint, setReportPoint] = useState(DEFAULT_START);
  const [reportCategory, setReportCategory] = useState('incident');
  const [reportSeverity, setReportSeverity] = useState(3);
  const [authMode, setAuthMode] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [phoneSettings, setPhoneSettings] = useState(defaultPhoneSettings);

  const baseRouteCoords = useMemo(() => routeCoordinates(route), [route]);
  const activeCoords = useMemo(() => {
    if (!navigationActive || !currentNavigationPoint) return baseRouteCoords;
    return trimRouteCoordinates(baseRouteCoords, currentNavigationPoint);
  }, [baseRouteCoords, navigationActive, currentNavigationPoint]);
  const navigationStats = useMemo(() => {
    const distanceKm = getPolylineDistanceKm(activeCoords);
    const originalDistanceKm = route?.summary?.distanceKm || 0;
    const originalDurationMin = route?.summary?.durationMin || 0;
    const durationMin = originalDistanceKm > 0
      ? originalDurationMin * (distanceKm / originalDistanceKm)
      : 0;
    return { distanceKm, durationMin };
  }, [activeCoords, route]);
  const isSignedIn = Boolean(token && user);
  const language = phoneSettings.language || defaultPhoneSettings.language;
  const t = useMemo(() => (key, params) => translate(language, key, params), [language]);

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => () => {
    if (navigationWatcherRef.current) {
      navigationWatcherRef.current.remove();
      navigationWatcherRef.current = null;
    }
  }, []);

  async function bootstrap() {
    await Promise.all([loadSession(), loadMapData(), loadPhoneSettings(), loadFavorites()]);
    setBooting(false);
  }

  async function loadPhoneSettings() {
    const storedPhoneSettings = await AsyncStorage.getItem(STORAGE_KEYS.phoneSettings);
    if (!storedPhoneSettings) return;
    setPhoneSettings({ ...defaultPhoneSettings, ...JSON.parse(storedPhoneSettings) });
  }

  async function loadSession() {
    const [storedToken, storedUser, storedPreferences] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.token),
      AsyncStorage.getItem(STORAGE_KEYS.user),
      AsyncStorage.getItem(STORAGE_KEYS.guestPreferences)
    ]);

    let nextPreferences = storedPreferences
      ? { ...defaultPreferences, ...JSON.parse(storedPreferences) }
      : defaultPreferences;

    if (storedToken) {
      try {
        const payload = await fetchMe(storedToken);
        setToken(storedToken);
        setUser(payload.user);
        nextPreferences = { ...defaultPreferences, ...(payload.preferences || {}) };
        await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(payload.user));
      } catch {
        await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
        if (storedUser) setUser(null);
      }
    }

    setPreferences(nextPreferences);
  }

  async function loadMapData() {
    try {
      const [riskPayload, reportPayload, placePayload, featurePayload] = await Promise.all([
        fetchRisks(),
        fetchReports(),
        fetchPlaces(),
        fetchMapFeatures()
      ]);
      setRisks(riskPayload.risks || []);
      setReports(reportPayload.reports || []);
      setPlaces(placePayload.places || []);
      setMapFeatures(featurePayload.features || []);
    } catch (error) {
      Alert.alert('SafeWay API', error.message);
    }
  }

  async function loadFavorites() {
    const storedFavorites = await AsyncStorage.getItem(STORAGE_KEYS.favorites);
    setFavorites(storedFavorites ? JSON.parse(storedFavorites) : []);
  }

  async function buildRoute({
    nextStart = start,
    nextEnd = end,
    nextRoutePoints = routePoints,
    nextPreferences = preferences
  } = {}) {
    const requestId = routeRequestRef.current + 1;
    routeRequestRef.current = requestId;
    setLoading(true);
    try {
      const avoid = buildAvoidList(nextPreferences);
      const points = nextRoutePoints?.length >= 2 ? nextRoutePoints : [nextStart, nextEnd];
      const invalidPoint = points.find((point) => !isPointInsideAlmaty(point));
      if (invalidPoint) {
        throw new Error(t('alert.routeOutOfAlmaty'));
      }
      const payload = await fetchSafeRoute({
        start: { lat: nextStart.lat, lng: nextStart.lng },
        end: { lat: nextEnd.lat, lng: nextEnd.lng },
        waypoints: points.map((point) => ({ title: point.title, lat: point.lat, lng: point.lng })),
        profile: nextPreferences.profile,
        avoid,
        departureHour: nextPreferences.nightRoute ? 22 : new Date().getHours()
      });
      if (!payload.recommended) {
        throw new Error(t('alert.routeNoRecommended'));
      }
      if (requestId !== routeRequestRef.current) return;
      setRoute(payload.recommended);
      setAlternatives(payload.alternatives || []);
      setRoutePlannerOpen(true);
      setRoutePanelHidden(false);
      stopNavigation();
      fitRoute(payload.recommended);
    } catch (error) {
      if (requestId === routeRequestRef.current) {
        Alert.alert(t('alert.routeBuildFailed'), error.message);
      }
    } finally {
      if (requestId === routeRequestRef.current) {
        setLoading(false);
      }
    }
  }

  function buildAvoidList(settings) {
    const values = new Set(settings.avoid || []);
    if (settings.preferLitStreets) values.add('poor_lighting');
    if (settings.maxRiskLevel <= 2) {
      values.add('crowd');
      values.add('traffic');
    }
    return [...values];
  }

  async function updatePreferences(patch, options = {}) {
    const nextPreferences = { ...preferences, ...patch };
    setPreferences(nextPreferences);
    await AsyncStorage.setItem(STORAGE_KEYS.guestPreferences, JSON.stringify(nextPreferences));

    if (token) {
      try {
        await saveRemotePreferences(nextPreferences, token);
      } catch (error) {
        Alert.alert(t('tab.settings'), t('alert.settingsSavedLocal', { message: error.message }));
      }
    }

    if (options.rebuild !== false && routePlannerOpen) {
      buildRoute({ nextPreferences });
    }
  }

  async function updatePhoneSettings(patch) {
    const nextPhoneSettings = { ...phoneSettings, ...patch };
    setPhoneSettings(nextPhoneSettings);
    await AsyncStorage.setItem(STORAGE_KEYS.phoneSettings, JSON.stringify(nextPhoneSettings));
  }

  async function useMyLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('alert.geoTitle'), t('alert.geoPermissionStart'));
      return;
    }
    const location = await Location.getCurrentPositionAsync({});
    const nextStart = {
      title: t('common.myLocation'),
      lat: location.coords.latitude,
      lng: location.coords.longitude
    };
    const routeStart = isPointInsideAlmaty(nextStart) ? nextStart : DEFAULT_START;
    if (routeStart !== nextStart) {
      Alert.alert(t('alert.geoOutsideTitle'), t('alert.geoOutsideStart'));
    }
    setStart(routeStart);
    const nextRoutePoints = [routeStart, ...routePoints.slice(1)];
    setRoutePoints(nextRoutePoints);
    setRoutePlannerOpen(true);
    buildRoute({ nextStart: routeStart, nextRoutePoints });
  }

  async function buildRouteFromMyLocation(item) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('alert.geoTitle'), t('alert.geoPermissionRoute'));
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const currentPoint = {
      title: t('common.myLocation'),
      lat: location.coords.latitude,
      lng: location.coords.longitude
    };
    const routeStart = isPointInsideAlmaty(currentPoint) ? currentPoint : start;
    if (routeStart !== currentPoint) {
      Alert.alert(t('alert.geoOutsideTitle'), t('alert.geoOutsideRoute'));
    }
    const destination = toRoutePoint(item);
    const nextRoutePoints = [routeStart, destination];
    setStart(routeStart);
    setEnd(destination);
    setRoutePoints(nextRoutePoints);
    setSearchOpen(false);
    setRoutePlannerOpen(true);
    buildRoute({ nextStart: routeStart, nextEnd: destination, nextRoutePoints });
  }

  async function openReportAtCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        openReport(start);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const point = {
        title: t('common.myLocation'),
        lat: location.coords.latitude,
        lng: location.coords.longitude
      };
      openReport(isPointInsideAlmaty(point) ? point : start);
    } catch {
      openReport(start);
    }
  }

  function fitRoute(nextRoute) {
    const coordinates = routeCoordinates(nextRoute);
    if (!coordinates.length || !mapRef.current) return;
    const routeBottomPadding = phoneSettings.compactRouteCard ? 260 : 360;
    setTimeout(() => {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 120, right: 48, bottom: routeBottomPadding + phoneSettings.bottomGuard, left: 48 },
        animated: true
      });
    }, 250);
  }

  function swapRoute() {
    const nextStart = end;
    const nextEnd = start;
    const nextRoutePoints = [...routePoints].reverse();
    setStart(nextStart);
    setEnd(nextEnd);
    setRoutePoints(nextRoutePoints);
    setRoutePlannerOpen(true);
    buildRoute({ nextStart, nextEnd, nextRoutePoints });
  }

  async function runSearch(query = searchQuery) {
    if (!query.trim() || query.trim().length < 2) {
      searchRequestRef.current += 1;
      setSearchResults([]);
      return;
    }
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setSearchLoading(true);
    try {
      const payload = await searchPlaces(query.trim());
      if (requestId === searchRequestRef.current) {
        setSearchResults(payload.results || []);
      }
    } catch (error) {
      if (requestId === searchRequestRef.current) {
        Alert.alert(t('alert.searchTitle'), error.message);
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearchLoading(false);
      }
    }
  }

  function toRoutePoint(item) {
    return {
      id: item.id,
      title: item.title,
      lat: Number(item.lat),
      lng: Number(item.lng),
      subtitle: item.subtitle,
      category: item.category
    };
  }

  function setRoutePointAt(index, item) {
    const point = toRoutePoint(item);
    const nextRoutePoints = [...routePoints];
    nextRoutePoints[index] = point;
    setRoutePoints(nextRoutePoints);
    setStart(nextRoutePoints[0]);
    setEnd(nextRoutePoints[nextRoutePoints.length - 1]);
    setSearchOpen(false);
    setRoutePlannerOpen(true);
    buildRoute({
      nextStart: nextRoutePoints[0],
      nextEnd: nextRoutePoints[nextRoutePoints.length - 1],
      nextRoutePoints
    });
  }

  function addWaypoint(item) {
    const point = toRoutePoint(item);
    const nextRoutePoints = [...routePoints.slice(0, -1), point, routePoints[routePoints.length - 1]];
    setRoutePoints(nextRoutePoints);
    setSearchOpen(false);
    setRoutePlannerOpen(true);
    buildRoute({ nextStart: nextRoutePoints[0], nextEnd: nextRoutePoints[nextRoutePoints.length - 1], nextRoutePoints });
  }

  function removeWaypoint(index) {
    if (routePoints.length <= 2) return;
    const nextRoutePoints = routePoints.filter((_, itemIndex) => itemIndex !== index);
    setRoutePoints(nextRoutePoints);
    setStart(nextRoutePoints[0]);
    setEnd(nextRoutePoints[nextRoutePoints.length - 1]);
    setRoutePlannerOpen(true);
    buildRoute({ nextStart: nextRoutePoints[0], nextEnd: nextRoutePoints[nextRoutePoints.length - 1], nextRoutePoints });
  }

  async function saveFavorite(item) {
    const point = toRoutePoint(item);
    const exists = favorites.some((favorite) => favorite.id === point.id);
    const nextFavorites = exists ? favorites : [point, ...favorites].slice(0, 20);
    setFavorites(nextFavorites);
    await AsyncStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(nextFavorites));
  }

  function toggleLayer(key) {
    setVisibleLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  function selectRouteOption(nextRoute) {
    if (!nextRoute) return;
    setRoute(nextRoute);
    setAlternatives((items) => [route, ...items].filter((item) => item && item.id !== nextRoute.id));
    fitRoute(nextRoute);
  }

  function closeRoutePlanner() {
    setRoutePlannerOpen(false);
    setRoute(null);
    setAlternatives([]);
    setRoutePanelHidden(false);
    stopNavigation();
  }

  function hideRoutePanel() {
    if (!route) return;
    setRoutePanelHidden(true);
  }

  function showRoutePanelWindow() {
    if (!route) return;
    setRoutePlannerOpen(true);
    setRoutePanelHidden(false);
  }

  async function startNavigation() {
    if (!route) {
      Alert.alert(t('alert.routeTitle'), t('alert.routeBuildFirst'));
      return;
    }
    const routeCoords = routeCoordinates(route);
    if (routeCoords.length < 2) {
      Alert.alert(t('alert.routeTitle'), t('alert.routeNoLine'));
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('alert.geoTitle'), t('alert.geoPermissionNavigate'));
      return;
    }

    if (navigationWatcherRef.current) {
      navigationWatcherRef.current.remove();
      navigationWatcherRef.current = null;
    }

    const initial = await Location.getCurrentPositionAsync({});
    const initialPoint = {
      lat: initial.coords.latitude,
      lng: initial.coords.longitude
    };
    setCurrentNavigationPoint(initialPoint);
    setNavigationActive(true);
    setRoutePanelHidden(true);

    navigationWatcherRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 8,
        timeInterval: 2500
      },
      (location) => {
        const point = {
          lat: location.coords.latitude,
          lng: location.coords.longitude
        };
        setCurrentNavigationPoint(point);
        const remainingKm = getPolylineDistanceKm(trimRouteCoordinates(routeCoords, point));
        if (remainingKm < 0.04) {
          stopNavigation();
          setRoutePanelHidden(false);
          Alert.alert(t('alert.routeTitle'), t('alert.routeFinished'));
          return;
        }

        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: point.lat,
            longitude: point.lng,
            latitudeDelta: 0.018,
            longitudeDelta: 0.018
          }, 450);
        }
      }
    );
  }

  function stopNavigation() {
    if (navigationWatcherRef.current) {
      navigationWatcherRef.current.remove();
      navigationWatcherRef.current = null;
    }
    setNavigationActive(false);
    setCurrentNavigationPoint(null);
  }

  function openReport(point = start) {
    setReportPoint(point);
    setReportCategory('incident');
    setReportSeverity(Math.max(1, Math.min(5, preferences.maxRiskLevel)));
    setReportOpen(true);
  }

  async function submitReport() {
    if (!reportText.trim()) {
      Alert.alert(t('alert.reportTitle'), t('alert.reportDescribe'));
      return;
    }

    try {
      const payload = await sendReport({
        category: reportCategory,
        severity: reportSeverity,
        description: reportText,
        location: { lat: reportPoint.lat, lng: reportPoint.lng }
      }, token);
      if (payload.report) {
        setReports((current) => [payload.report, ...current.filter((item) => item.id !== payload.report.id)]);
        setVisibleLayers((current) => ({ ...current, reports: true }));
      }
      setReportText('');
      setReportOpen(false);
      Alert.alert(t('alert.reportSent'), isSignedIn
        ? t('alert.reportSavedUser')
        : t('alert.reportSavedGuest'));
    } catch (error) {
      Alert.alert(t('alert.reportTitle'), error.message);
    }
  }

  async function submitAuth() {
    setAuthLoading(true);
    try {
      const payload = authMode === 'register'
        ? await registerUser({ ...authForm, preferences })
        : await loginUser({ email: authForm.email, password: authForm.password, preferences });

      setToken(payload.token);
      setUser(payload.user);
      setPreferences({ ...defaultPreferences, ...(payload.preferences || {}) });
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.token, payload.token],
        [STORAGE_KEYS.user, JSON.stringify(payload.user)],
        [STORAGE_KEYS.guestPreferences, JSON.stringify(payload.preferences || preferences)]
      ]);
      setAuthMode(null);
      setAuthForm({ name: '', email: '', password: '' });
      if (routePlannerOpen) {
        buildRoute({ nextPreferences: { ...defaultPreferences, ...(payload.preferences || {}) } });
      }
    } catch (error) {
      Alert.alert(authMode === 'register' ? t('alert.authRegister') : t('alert.authLogin'), error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([STORAGE_KEYS.token, STORAGE_KEYS.user]);
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        {screen === 'map' && (
          <MapScreen
            mapRef={mapRef}
            start={start}
            end={end}
            route={route}
            alternatives={alternatives}
            risks={risks}
            reports={reports}
            places={places}
            mapFeatures={mapFeatures}
            routePoints={routePoints}
            routePlannerOpen={routePlannerOpen}
            routePanelHidden={routePanelHidden}
            navigationActive={navigationActive}
            navigationStats={navigationStats}
            visibleLayers={visibleLayers}
            activeCoords={activeCoords}
            loading={loading || booting}
            preferences={preferences}
            phoneSettings={phoneSettings}
            language={language}
            t={t}
            openSearch={() => setSearchOpen(true)}
            openReport={openReport}
            openReportAtCurrentLocation={openReportAtCurrentLocation}
            useMyLocation={useMyLocation}
            swapRoute={swapRoute}
            updatePreferences={updatePreferences}
            toggleLayer={toggleLayer}
            removeWaypoint={removeWaypoint}
            selectRouteOption={selectRouteOption}
            hideRoutePanel={hideRoutePanel}
            showRoutePanelWindow={showRoutePanelWindow}
            startNavigation={startNavigation}
            stopNavigation={stopNavigation}
            closeRoutePlanner={closeRoutePlanner}
          />
        )}

        {screen === 'profile' && (
          <ProfileScreen
            user={user}
            isSignedIn={isSignedIn}
            route={route}
            reportCount={risks.length}
            openAuth={setAuthMode}
            logout={logout}
            phoneSettings={phoneSettings}
            language={language}
            t={t}
          />
        )}

        {screen === 'settings' && (
          <SettingsScreen
            preferences={preferences}
            updatePreferences={updatePreferences}
            rebuild={() => routePlannerOpen ? buildRoute({ nextPreferences: preferences }) : setSearchOpen(true)}
            phoneSettings={phoneSettings}
            language={language}
            t={t}
            updatePhoneSettings={updatePhoneSettings}
            openPhoneSettings={() => setScreen('phone')}
          />
        )}

        {screen === 'phone' && (
          <PhoneSettingsScreen
            phoneSettings={phoneSettings}
            updatePhoneSettings={updatePhoneSettings}
            t={t}
          />
        )}

        <BottomTabs screen={screen} setScreen={setScreen} phoneSettings={phoneSettings} t={t} />

        <ReportModal
          visible={reportOpen}
          value={reportText}
          onChange={setReportText}
          onClose={() => setReportOpen(false)}
          onSubmit={submitReport}
          isSignedIn={isSignedIn}
          phoneSettings={phoneSettings}
          t={t}
          point={reportPoint}
          category={reportCategory}
          setCategory={setReportCategory}
          severity={reportSeverity}
          setSeverity={setReportSeverity}
        />

        <AuthModal
          mode={authMode}
          form={authForm}
          setForm={setAuthForm}
          loading={authLoading}
          onClose={() => setAuthMode(null)}
          onSubmit={submitAuth}
          switchMode={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}
          phoneSettings={phoneSettings}
          t={t}
        />

        <SearchModal
          visible={searchOpen}
          query={searchQuery}
          setQuery={setSearchQuery}
          loading={searchLoading}
          results={searchResults}
          favorites={favorites}
          onSearch={runSearch}
          onClose={() => setSearchOpen(false)}
          onSetStart={(item) => setRoutePointAt(0, item)}
          onSetEnd={(item) => setRoutePointAt(routePoints.length - 1, item)}
          onAddWaypoint={addWaypoint}
          onRouteFromMe={buildRouteFromMyLocation}
          onSaveFavorite={saveFavorite}
          onReportPoint={(item) => {
            setSearchOpen(false);
            openReport(item);
          }}
          phoneSettings={phoneSettings}
          t={t}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function MapScreen({
  mapRef,
  start,
  end,
  route,
  alternatives,
  risks,
  reports,
  places,
  mapFeatures,
  routePoints,
  routePlannerOpen,
  routePanelHidden,
  navigationActive,
  navigationStats,
  visibleLayers,
  activeCoords,
  loading,
  preferences,
  phoneSettings,
  language,
  t,
  openSearch,
  openReport,
  openReportAtCurrentLocation,
  useMyLocation,
  swapRoute,
  updatePreferences,
  toggleLayer,
  removeWaypoint,
  selectRouteOption,
  hideRoutePanel,
  showRoutePanelWindow,
  startNavigation,
  stopNavigation,
  closeRoutePlanner
}) {
  const layout = usePhoneLayout(phoneSettings);
  const panelStyles = [
    styles.bottomPanel,
    { bottom: layout.panelBottom },
    phoneSettings.compactRouteCard && styles.bottomPanelCompact
  ];
  const hasRoute = Boolean(route);
  const showRoutePanel = (routePlannerOpen || hasRoute) && !routePanelHidden;
  const showRouteMini = hasRoute && routePanelHidden;
  const displayDistanceKm = navigationActive ? navigationStats.distanceKm : route?.summary?.distanceKm;
  const displayDurationMin = navigationActive ? navigationStats.durationMin : route?.summary?.durationMin;

  return (
    <>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={ALMATY_REGION}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        showsUserLocation
        showsCompass={false}
        toolbarEnabled={false}
        onLongPress={(event) => {
          const coordinate = event.nativeEvent.coordinate;
          openReport({
            title: t('common.selectedPoint'),
            lat: coordinate.latitude,
            lng: coordinate.longitude
          });
        }}
      >
        <UrlTile urlTemplate={BASE_TILE_URL} maximumZ={19} flipY={false} />

        {alternatives.map((item) => (
          <Polyline
            key={item.id}
            coordinates={routeCoordinates(item)}
            strokeColor="rgba(18, 103, 168, 0.24)"
            strokeWidth={5}
          />
        ))}

        {!!activeCoords.length && (
          <Polyline
            coordinates={activeCoords}
            strokeColor={route?.safetyScore >= 70 ? colors.primary : colors.warning}
            strokeWidth={7}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {hasRoute && (
          <>
            <Marker coordinate={toCoordinate(start)} title={start.title} pinColor={colors.primary} />
            <Marker coordinate={toCoordinate(end)} title={end.title} pinColor={colors.accent} />
          </>
        )}

        {mapFeatures
          .filter((feature) => visibleLayers[feature.category])
          .map((feature) => {
            const config = layerConfig[feature.category] || layerConfig.safe_zone;
            const coordinates = (feature.geometry || []).map(toCoordinate);
            if (coordinates.length > 1) {
              return (
                <Polyline
                  key={feature.id}
                  coordinates={coordinates}
                  strokeColor={config.color}
                  strokeWidth={feature.category === 'lit_street' ? 6 : 5}
                  lineCap="round"
                  lineJoin="round"
                />
              );
            }
            return coordinates[0] && feature.category !== 'safe_zone' && feature.category !== 'transport_hub' ? (
              <Marker
                key={feature.id}
                coordinate={coordinates[0]}
                title={feature.title}
                description={t(config.labelKey)}
                pinColor={config.color}
              />
            ) : null;
          })}

        {visibleLayers.risks && risks.map((risk) => (
          <Marker
            key={risk.id}
            coordinate={{ latitude: Number(risk.lat), longitude: Number(risk.lng) }}
            title={risk.title}
            description={categoryLabel(risk.category, language)}
            pinColor={risk.severity >= 4 ? colors.danger : colors.warning}
          />
        ))}

        {visibleLayers.reports && reports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: Number(report.lat), longitude: Number(report.lng) }}
            title={categoryLabel(report.category, language)}
            description={report.description || t('map.userReport')}
            pinColor={report.severity >= 4 ? colors.danger : colors.warning}
          />
        ))}

        {places
          .filter((place) => (
            (visibleLayers.police && place.type === 'police') ||
            (visibleLayers.hospital && place.type === 'hospital') ||
            (visibleLayers.places && place.type !== 'police' && place.type !== 'hospital')
          ))
          .map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: Number(place.lat), longitude: Number(place.lng) }}
            title={place.title}
            description={place.type}
            pinColor={place.type === 'police' ? layerConfig.police.color : place.type === 'hospital' ? layerConfig.hospital.color : colors.accent}
          />
        ))}
      </MapView>

      <View style={[styles.mapAttribution, { bottom: layout.panelBottom + (phoneSettings.compactRouteCard ? 216 : 318) }]} pointerEvents="none">
        <Text style={styles.mapAttributionText}>© OpenStreetMap contributors © CARTO</Text>
      </View>

      <View style={styles.topBar}>
        <Pressable style={styles.searchButton} onPress={openSearch}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <View style={styles.searchCopy}>
            <Text style={styles.searchLabel}>{t('map.searchLabel')}</Text>
            <Text style={styles.searchHint} numberOfLines={1}>{t('map.searchHint')}</Text>
          </View>
        </Pressable>
        <View>
          <Text style={styles.appName}>SafeWay</Text>
          <Text style={styles.city}>{t('common.city')}</Text>
        </View>
        <View style={styles.topActions}>
          <IconButton icon="locate" onPress={useMyLocation} />
          <IconButton icon="alert-circle" onPress={() => openReport(start)} />
        </View>
      </View>

      <View style={styles.mapFabColumn}>
        <Pressable style={styles.mapFabButton} onPress={openReportAtCurrentLocation}>
          <Ionicons name="add-circle" size={24} color={colors.surface} />
          <Text style={styles.mapFabText}>{t('map.event')}</Text>
        </Pressable>
      </View>

      {showRouteMini && (
        <View style={[styles.routeMiniBar, { bottom: layout.tabBottom + 76 }]}>
          <Pressable style={styles.routeMiniMain} onPress={showRoutePanelWindow}>
            <Ionicons name={navigationActive ? 'navigate' : 'map'} size={20} color={colors.primary} />
            <View style={styles.routeMiniCopy}>
              <Text style={styles.routeMiniTitle}>{navigationActive ? t('map.routeActive') : t('map.routeHidden')}</Text>
              <Text style={styles.routeMiniMeta}>
                {formatDistance(displayDistanceKm, language)} · {formatDuration(displayDurationMin, language)}
              </Text>
            </View>
          </Pressable>
          {navigationActive ? (
            <Pressable style={styles.routeMiniIcon} onPress={stopNavigation}>
              <Ionicons name="stop" size={18} color={colors.danger} />
            </Pressable>
          ) : (
            <Pressable style={styles.routeMiniIcon} onPress={startNavigation}>
              <Ionicons name="play" size={18} color={colors.primary} />
            </Pressable>
          )}
        </View>
      )}

      {!showRoutePanel && !showRouteMini && (
        <View style={[styles.layerDock, { bottom: layout.tabBottom + 76 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerChips}>
            {Object.entries(layerConfig).map(([key, config]) => (
              <Pressable key={key} style={[styles.layerChip, visibleLayers[key] && { backgroundColor: config.color, borderColor: config.color }]} onPress={() => toggleLayer(key)}>
                <Ionicons name={config.icon} size={15} color={visibleLayers[key] ? colors.surface : colors.muted} />
                <Text style={[styles.layerChipText, visibleLayers[key] && styles.layerChipTextActive]}>{t(config.labelKey)}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.layerChip, visibleLayers.places && styles.layerChipActive]} onPress={() => toggleLayer('places')}>
              <Ionicons name="business" size={15} color={visibleLayers.places ? colors.surface : colors.muted} />
              <Text style={[styles.layerChipText, visibleLayers.places && styles.layerChipTextActive]}>{t('layer.places')}</Text>
            </Pressable>
            <Pressable style={[styles.layerChip, visibleLayers.risks && styles.layerChipDanger]} onPress={() => toggleLayer('risks')}>
              <Ionicons name="warning" size={15} color={visibleLayers.risks ? colors.surface : colors.muted} />
              <Text style={[styles.layerChipText, visibleLayers.risks && styles.layerChipTextActive]}>{t('layer.risks')}</Text>
            </Pressable>
            <Pressable style={[styles.layerChip, visibleLayers.reports && styles.layerChipDanger]} onPress={() => toggleLayer('reports')}>
              <Ionicons name="alert-circle" size={15} color={visibleLayers.reports ? colors.surface : colors.muted} />
              <Text style={[styles.layerChipText, visibleLayers.reports && styles.layerChipTextActive]}>{t('layer.reports')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {showRoutePanel && <View style={panelStyles}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerChips}>
          {Object.entries(layerConfig).map(([key, config]) => (
            <Pressable key={key} style={[styles.layerChip, visibleLayers[key] && { backgroundColor: config.color, borderColor: config.color }]} onPress={() => toggleLayer(key)}>
              <Ionicons name={config.icon} size={15} color={visibleLayers[key] ? colors.surface : colors.muted} />
              <Text style={[styles.layerChipText, visibleLayers[key] && styles.layerChipTextActive]}>{t(config.labelKey)}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.layerChip, visibleLayers.places && styles.layerChipActive]} onPress={() => toggleLayer('places')}>
            <Ionicons name="business" size={15} color={visibleLayers.places ? colors.surface : colors.muted} />
            <Text style={[styles.layerChipText, visibleLayers.places && styles.layerChipTextActive]}>{t('layer.places')}</Text>
          </Pressable>
          <Pressable style={[styles.layerChip, visibleLayers.risks && styles.layerChipDanger]} onPress={() => toggleLayer('risks')}>
            <Ionicons name="warning" size={15} color={visibleLayers.risks ? colors.surface : colors.muted} />
            <Text style={[styles.layerChipText, visibleLayers.risks && styles.layerChipTextActive]}>{t('layer.risks')}</Text>
          </Pressable>
          <Pressable style={[styles.layerChip, visibleLayers.reports && styles.layerChipDanger]} onPress={() => toggleLayer('reports')}>
            <Ionicons name="alert-circle" size={15} color={visibleLayers.reports ? colors.surface : colors.muted} />
            <Text style={[styles.layerChipText, visibleLayers.reports && styles.layerChipTextActive]}>{t('layer.reports')}</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.routeHeader}>
          <View style={styles.scoreBadge}>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.scoreText}>{route?.safetyScore || '--'}</Text>
            )}
            <Text style={styles.scoreLabel}>{t('map.index')}</Text>
          </View>
          <View style={styles.routeTitleBlock}>
            <Text style={styles.routeTitle}>
              {navigationActive ? t('map.navigation') : (language === 'ru' && route?.summary?.safetyLabel) || t('map.safeRoute')}
            </Text>
            <Text style={styles.routeSubtitle}>
              {formatDistance(displayDistanceKm, language)} · {formatDuration(displayDurationMin, language)}
            </Text>
          </View>
          <Pressable style={styles.closeRouteButton} onPress={closeRoutePlanner}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.routePrimaryActions}>
          <Pressable
            style={[styles.routePrimaryAction, navigationActive && styles.routeStopAction]}
            onPress={navigationActive ? stopNavigation : startNavigation}
          >
            <Ionicons name={navigationActive ? 'stop' : 'play'} size={18} color={colors.surface} />
            <Text style={styles.routePrimaryActionText}>
              {navigationActive ? t('map.stopRoute') : t('map.startRoute')}
            </Text>
          </Pressable>
          <Pressable style={styles.routeSecondaryAction} onPress={hideRoutePanel}>
            <Ionicons name="chevron-down" size={18} color={colors.ink} />
            <Text style={styles.routeSecondaryActionText}>{t('map.hidePanel')}</Text>
          </Pressable>
        </View>

        <View style={styles.points}>
          {routePoints.map((point, index) => (
            <PointRow
              key={`${point.title}-${index}`}
              color={index === 0 ? colors.primary : index === routePoints.length - 1 ? colors.accent : colors.warning}
              title={`${index + 1}. ${point.title}`}
              removable={routePoints.length > 2 && index > 0 && index < routePoints.length - 1}
              onRemove={() => removeWaypoint(index)}
            />
          ))}
          {!navigationActive && (
            <Pressable style={styles.addWaypointButton} onPress={swapRoute}>
              <Ionicons name="swap-vertical" size={18} color={colors.primary} />
              <Text style={styles.addWaypointText}>{t('map.swapRoute')}</Text>
            </Pressable>
          )}
          <Pressable style={styles.addWaypointButton} onPress={openSearch}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addWaypointText}>{t('map.addWaypoint')}</Text>
          </Pressable>
        </View>

        <View style={styles.segmented}>
          {profiles.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.segmentButton, preferences.profile === item.key && styles.segmentButtonActive]}
              onPress={() => updatePreferences({ profile: item.key })}
            >
              <Ionicons name={item.icon} size={18} color={preferences.profile === item.key ? colors.surface : colors.muted} />
              <Text style={[styles.segmentText, preferences.profile === item.key && styles.segmentTextActive]}>{t(item.labelKey)}</Text>
            </Pressable>
          ))}
        </View>

        {!phoneSettings.compactRouteCard && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable
            style={[styles.chip, preferences.nightRoute && styles.chipActive]}
            onPress={() => updatePreferences({ nightRoute: !preferences.nightRoute })}
          >
            <Ionicons name="moon" size={16} color={preferences.nightRoute ? colors.surface : colors.muted} />
            <Text style={[styles.chipText, preferences.nightRoute && styles.chipTextActive]}>{t('map.night')}</Text>
          </Pressable>
          {avoidOptions.slice(0, 4).map((item) => {
            const active = preferences.avoid.includes(item.key);
            return (
              <Pressable
                key={item.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  const avoid = active
                    ? preferences.avoid.filter((value) => value !== item.key)
                    : [...preferences.avoid, item.key];
                  updatePreferences({ avoid });
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(item.labelKey)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>}

        {!phoneSettings.compactRouteCard && <View style={styles.insights}>
          {!!alternatives.length && (
            <View style={styles.routeOptions}>
              {[route, ...alternatives].filter(Boolean).slice(0, 3).map((item, index) => {
                const active = item.id === route?.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.routeOption, active && styles.routeOptionActive]}
                    onPress={() => selectRouteOption(item)}
                  >
                    <Text style={[styles.routeOptionValue, active && styles.routeOptionTextActive]}>{item.safetyScore}</Text>
                    <Text style={[styles.routeOptionLabel, active && styles.routeOptionTextActive]}>
                      {index === 0 ? t('map.best') : t('map.variant', { number: index + 1 })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {(route?.safeHits || []).slice(0, 2).map((feature) => (
            <View key={feature.id} style={[styles.insightItem, styles.safeInsightItem]}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.primary} />
              <Text style={styles.insightText} numberOfLines={2}>
                {layerConfig[feature.category]?.labelKey ? t(layerConfig[feature.category].labelKey) : t('map.safe')}: {feature.title}
              </Text>
            </View>
          ))}
          {(route?.riskHits || []).slice(0, 2).map((risk) => (
            <View key={risk.id} style={styles.insightItem}>
              <MaterialCommunityIcons name="shield-alert-outline" size={18} color={colors.warning} />
              <Text style={styles.insightText} numberOfLines={2}>
                {categoryLabel(risk.category, language)}: {risk.title}
              </Text>
            </View>
          ))}
          {!route?.riskHits?.length && (
            <View style={styles.insightItem}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.primary} />
              <Text style={styles.insightText}>{t('map.noRisks')}</Text>
            </View>
          )}
        </View>}
      </View>}
    </>
  );
}

function ProfileScreen({ user, isSignedIn, route, reportCount, openAuth, logout, phoneSettings, language, t }) {
  const layout = usePhoneLayout(phoneSettings);

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.pageContent, { paddingBottom: layout.pageBottomPadding }]}>
      <Text style={styles.pageTitle}>{t('profile.title')}</Text>
      <View style={styles.profileHero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{isSignedIn ? user.name.slice(0, 1).toUpperCase() : 'G'}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{isSignedIn ? user.name : t('common.guest')}</Text>
          <Text style={styles.profileMeta}>{isSignedIn ? user.email : t('profile.guestMeta')}</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <Metric label={t('metric.index')} value={route?.safetyScore || '--'} />
        <Metric label={t('metric.time')} value={formatDuration(route?.summary?.durationMin, language)} />
        <Metric label={t('metric.risks')} value={String(route?.summary?.riskCount ?? 0)} />
        <Metric label={t('metric.zones')} value={String(reportCount)} />
      </View>

      {isSignedIn ? (
        <Pressable style={styles.dangerButton} onPress={logout}>
          <Text style={styles.dangerButtonText}>{t('profile.logout')}</Text>
        </Pressable>
      ) : (
        <View style={styles.authActions}>
          <Pressable style={styles.primaryButton} onPress={() => openAuth('login')}>
            <Text style={styles.primaryButtonText}>{t('auth.login')}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => openAuth('register')}>
            <Text style={styles.secondaryButtonText}>{t('auth.register')}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.infoBlock}>
        <Text style={styles.infoTitle}>{t('profile.guestTitle')}</Text>
        <Text style={styles.infoText}>{t('profile.guestInfo')}</Text>
      </View>
    </ScrollView>
  );
}

function SettingsScreen({ preferences, updatePreferences, rebuild, phoneSettings, language, t, updatePhoneSettings, openPhoneSettings }) {
  const layout = usePhoneLayout(phoneSettings);

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.pageContent, { paddingBottom: layout.pageBottomPadding }]}>
      <Text style={styles.pageTitle}>{t('settings.routeTitle')}</Text>

      <Section title={t('settings.language')}>
        <View style={styles.optionRow}>
          {LANGUAGE_OPTIONS.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.optionPill, language === item.key && styles.optionPillActive]}
              onPress={() => updatePhoneSettings({ language: item.key })}
            >
              <Text style={[styles.optionPillText, language === item.key && styles.optionPillTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.settingHint}>{t('settings.languageHint')}</Text>
      </Section>

      <Section title={t('settings.priority')}>
        <View style={styles.optionRow}>
          {priorities.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.optionPill, preferences.routePriority === item.key && styles.optionPillActive]}
              onPress={() => updatePreferences({ routePriority: item.key })}
            >
              <Text style={[styles.optionPillText, preferences.routePriority === item.key && styles.optionPillTextActive]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title={t('settings.transport')}>
        <View style={styles.optionRow}>
          {profiles.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.optionPill, preferences.profile === item.key && styles.optionPillActive]}
              onPress={() => updatePreferences({ profile: item.key })}
            >
              <Ionicons name={item.icon} size={16} color={preferences.profile === item.key ? colors.surface : colors.muted} />
              <Text style={[styles.optionPillText, preferences.profile === item.key && styles.optionPillTextActive]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title={t('settings.avoid')}>
        <View style={styles.wrapGrid}>
          {avoidOptions.map((item) => {
            const active = preferences.avoid.includes(item.key);
            return (
              <Pressable
                key={item.key}
                style={[styles.checkChip, active && styles.checkChipActive]}
                onPress={() => {
                  const avoid = active
                    ? preferences.avoid.filter((value) => value !== item.key)
                    : [...preferences.avoid, item.key];
                  updatePreferences({ avoid });
                }}
              >
                <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={active ? colors.surface : colors.muted} />
                <Text style={[styles.checkChipText, active && styles.checkChipTextActive]}>{t(item.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title={t('settings.safety')}>
        <ToggleRow
          label={t('settings.nightLabel')}
          hint={t('settings.nightHint')}
          value={preferences.nightRoute}
          onValueChange={(value) => updatePreferences({ nightRoute: value })}
        />
        <ToggleRow
          label={t('settings.litLabel')}
          hint={t('settings.litHint')}
          value={preferences.preferLitStreets}
          onValueChange={(value) => updatePreferences({ preferLitStreets: value })}
        />
        <ToggleRow
          label={t('settings.publicLabel')}
          hint={t('settings.publicHint')}
          value={preferences.preferPublicPlaces}
          onValueChange={(value) => updatePreferences({ preferPublicPlaces: value }, { rebuild: false })}
        />
        <View style={styles.riskLevel}>
          <Text style={styles.settingLabel}>{t('settings.maxRisk', { level: preferences.maxRiskLevel })}</Text>
          <View style={styles.levelRow}>
            {[1, 2, 3, 4, 5].map((level) => (
              <Pressable
                key={level}
                style={[styles.levelButton, preferences.maxRiskLevel === level && styles.levelButtonActive]}
                onPress={() => updatePreferences({ maxRiskLevel: level })}
              >
                <Text style={[styles.levelText, preferences.maxRiskLevel === level && styles.levelTextActive]}>{level}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Section>

      <Section title={t('settings.device')}>
        <Pressable style={styles.deviceSettingsButton} onPress={openPhoneSettings}>
          <Ionicons name="phone-portrait" size={18} color={colors.primary} />
          <View style={styles.profileCopy}>
            <Text style={styles.settingLabel}>{t('settings.phoneTitle')}</Text>
            <Text style={styles.settingHint}>{t('settings.phoneHint')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </Section>

      <Pressable style={styles.primaryButtonWide} onPress={rebuild}>
        <Text style={styles.primaryButtonText}>{t('settings.rebuild')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function PhoneSettingsScreen({ phoneSettings, updatePhoneSettings, t }) {
  const layout = usePhoneLayout(phoneSettings);

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.pageContent, { paddingBottom: layout.pageBottomPadding }]}>
      <Text style={styles.pageTitle}>{t('phone.title')}</Text>

      <View style={styles.phoneHero}>
        <View style={styles.phoneIcon}>
          <Ionicons name="phone-portrait" size={26} color={colors.surface} />
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{phoneSettings.model}</Text>
          <Text style={styles.profileMeta}>{t('phone.bottomGuard', { px: layout.bottomGuard })}</Text>
        </View>
      </View>

      <Section title={t('phone.navSection')}>
        <View style={styles.optionRow}>
          {navigationModes.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.optionPill, phoneSettings.navigationMode === item.key && styles.optionPillActive]}
              onPress={() => updatePhoneSettings({ navigationMode: item.key })}
            >
              <Ionicons
                name={item.key === 'buttons' ? 'apps' : 'remove'}
                size={16}
                color={phoneSettings.navigationMode === item.key ? colors.surface : colors.muted}
              />
              <Text style={[styles.optionPillText, phoneSettings.navigationMode === item.key && styles.optionPillTextActive]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title={t('phone.bottomSection')}>
        <View style={styles.optionRow}>
          {bottomGuardLevels.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.optionPill, phoneSettings.bottomGuard === item.key && styles.optionPillActive]}
              onPress={() => updatePhoneSettings({ bottomGuard: item.key, navigationMode: 'buttons' })}
            >
              <Text style={[styles.optionPillText, phoneSettings.bottomGuard === item.key && styles.optionPillTextActive]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.settingHint}>{t('phone.bottomHint')}</Text>
      </Section>

      <Section title={t('phone.mapSection')}>
        <ToggleRow
          label={t('phone.compactLabel')}
          hint={t('phone.compactHint')}
          value={phoneSettings.compactRouteCard}
          onValueChange={(value) => updatePhoneSettings({ compactRouteCard: value })}
        />
        <ToggleRow
          label={t('phone.touchLabel')}
          hint={t('phone.touchHint')}
          value={phoneSettings.largeTouchTargets}
          onValueChange={(value) => updatePhoneSettings({ largeTouchTargets: value })}
        />
      </Section>
    </ScrollView>
  );
}

function isPointInsideAlmaty(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= ALMATY_BOUNDS.minLat &&
    lat <= ALMATY_BOUNDS.maxLat &&
    lng >= ALMATY_BOUNDS.minLng &&
    lng <= ALMATY_BOUNDS.maxLng
  );
}

function trimRouteCoordinates(coordinates, currentPoint) {
  if (!coordinates.length || !currentPoint) return coordinates;
  if (coordinates.length === 1) return coordinates;

  const current = {
    latitude: Number(currentPoint.lat),
    longitude: Number(currentPoint.lng)
  };
  if (!Number.isFinite(current.latitude) || !Number.isFinite(current.longitude)) return coordinates;

  let best = {
    index: 0,
    distance: Infinity,
    point: coordinates[0]
  };

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const projected = projectPointToSegment(current, coordinates[index], coordinates[index + 1]);
    const distance = coordinateDistanceMeters(current, projected);
    if (distance < best.distance) {
      best = { index, distance, point: projected };
    }
  }

  const tail = coordinates.slice(best.index + 1);
  return [best.point, ...tail].filter((point) => (
    Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
  ));
}

function getPolylineDistanceKm(coordinates) {
  if (!coordinates || coordinates.length < 2) return 0;
  let meters = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    meters += coordinateDistanceMeters(coordinates[index], coordinates[index + 1]);
  }
  return meters / 1000;
}

function projectPointToSegment(point, start, end) {
  const latScale = 110540;
  const lngScale = 111320 * Math.cos((point.latitude * Math.PI) / 180);
  const px = point.longitude * lngScale;
  const py = point.latitude * latScale;
  const ax = start.longitude * lngScale;
  const ay = start.latitude * latScale;
  const bx = end.longitude * lngScale;
  const by = end.latitude * latScale;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
    : 0;

  return {
    latitude: start.latitude + (end.latitude - start.latitude) * t,
    longitude: start.longitude + (end.longitude - start.longitude) * t
  };
}

function coordinateDistanceMeters(a, b) {
  const radius = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function SearchModal({
  visible,
  query,
  setQuery,
  loading,
  results,
  favorites,
  onSearch,
  onClose,
  onSetStart,
  onSetEnd,
  onAddWaypoint,
  onRouteFromMe,
  onSaveFavorite,
  onReportPoint,
  phoneSettings,
  t
}) {
  const layout = usePhoneLayout(phoneSettings);
  const [selectedItem, setSelectedItem] = useState(null);
  const items = query.trim().length >= 2 ? results : favorites;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={[styles.searchSheet, { paddingBottom: layout.sheetBottomPadding }]}>
          <View style={styles.searchHeader}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={19} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setSelectedItem(null);
                  if (value.trim().length >= 2) onSearch(value);
                }}
                onSubmitEditing={() => onSearch(query)}
                placeholder={t('search.placeholder')}
                placeholderTextColor={colors.muted}
                autoFocus
                style={styles.searchInput}
              />
            </View>
            <Pressable style={styles.searchClose} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>

          {selectedItem && (
            <View style={styles.placePreview}>
              <View style={styles.placePreviewTop}>
                <View style={styles.resultIcon}>
                  <Ionicons name={getResultIcon(selectedItem)} size={18} color={colors.primary} />
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{selectedItem.title}</Text>
                  <Text style={styles.resultSubtitle} numberOfLines={2}>{selectedItem.subtitle || selectedItem.category}</Text>
                </View>
              </View>
              <View style={styles.resultActions}>
                <Pressable style={[styles.smallActionButton, styles.primarySmallAction]} onPress={() => onRouteFromMe(selectedItem)}>
                  <Text style={styles.primarySmallActionText}>{t('search.toMe')}</Text>
                </Pressable>
                <Pressable style={styles.smallActionButton} onPress={() => onSetStart(selectedItem)}>
                  <Text style={styles.smallActionText}>{t('search.fromHere')}</Text>
                </Pressable>
                <Pressable style={styles.smallActionButton} onPress={() => onSetEnd(selectedItem)}>
                  <Text style={styles.smallActionText}>{t('search.toHere')}</Text>
                </Pressable>
                <Pressable style={styles.smallActionButton} onPress={() => onAddWaypoint(selectedItem)}>
                  <Text style={styles.smallActionText}>{t('search.via')}</Text>
                </Pressable>
                <Pressable style={styles.smallIconAction} onPress={() => onSaveFavorite(selectedItem)}>
                  <Ionicons name="star" size={17} color={colors.warning} />
                </Pressable>
                <Pressable style={styles.smallIconAction} onPress={() => onReportPoint(selectedItem)}>
                  <Ionicons name="alert-circle" size={17} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.searchResultHeader}>
            <Text style={styles.sectionTitle}>{query.trim().length >= 2 ? t('search.results') : t('search.favorites')}</Text>
            {loading && <ActivityIndicator color={colors.primary} />}
          </View>

          <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
            {items.map((item) => (
              <View key={item.id} style={styles.searchResultCard}>
                <Pressable style={styles.searchResultMain} onPress={() => setSelectedItem(item)}>
                  <View style={styles.resultIcon}>
                    <Ionicons name={getResultIcon(item)} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.profileCopy}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.resultSubtitle} numberOfLines={2}>{item.subtitle || item.category}</Text>
                  </View>
                </Pressable>
                <View style={styles.resultActions}>
                  <Pressable style={styles.smallActionButton} onPress={() => onSetStart(item)}>
                    <Text style={styles.smallActionText}>{t('search.start')}</Text>
                  </Pressable>
                  <Pressable style={styles.smallActionButton} onPress={() => onRouteFromMe(item)}>
                    <Text style={styles.smallActionText}>{t('search.route')}</Text>
                  </Pressable>
                  <Pressable style={styles.smallActionButton} onPress={() => onAddWaypoint(item)}>
                    <Text style={styles.smallActionText}>{t('search.waypoint')}</Text>
                  </Pressable>
                  <Pressable style={styles.smallIconAction} onPress={() => onSaveFavorite(item)}>
                    <Ionicons name="star" size={17} color={colors.warning} />
                  </Pressable>
                  <Pressable style={styles.smallIconAction} onPress={() => onReportPoint(item)}>
                    <Ionicons name="alert-circle" size={17} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
            {!items.length && !loading && (
              <Text style={styles.emptySearchText}>
                {query.trim().length >= 2 ? t('search.emptyResults') : t('search.emptyFavorites')}
              </Text>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getResultIcon(item) {
  if (item.source === 'map_feature') return layerConfig[item.category]?.icon || 'map';
  if (item.source === 'risk_zone') return 'warning';
  return 'location';
}

function AuthModal({ mode, form, setForm, loading, onClose, onSubmit, switchMode, phoneSettings, t }) {
  const visible = Boolean(mode);
  const isRegister = mode === 'register';
  const layout = usePhoneLayout(phoneSettings);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={[styles.sheet, { paddingBottom: layout.sheetBottomPadding }]}>
          <Text style={styles.reportTitle}>{isRegister ? t('auth.register') : t('auth.login')}</Text>
          <Text style={styles.reportHint}>{t('auth.description')}</Text>
          {isRegister && (
            <TextInput
              value={form.name}
              onChangeText={(name) => setForm({ ...form, name })}
              placeholder={t('auth.name')}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          )}
          <TextInput
            value={form.email}
            onChangeText={(email) => setForm({ ...form, email })}
            placeholder={t('auth.email')}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TextInput
            value={form.password}
            onChangeText={(password) => setForm({ ...form, password })}
            placeholder={t('auth.password')}
            secureTextEntry
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.reportActions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>{t('auth.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>{isRegister ? t('auth.create') : t('auth.login')}</Text>}
            </Pressable>
          </View>
          <Pressable style={styles.linkButton} onPress={switchMode}>
            <Text style={styles.linkText}>{isRegister ? t('auth.haveAccount') : t('auth.registerLink')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ReportModal({
  visible,
  value,
  onChange,
  onClose,
  onSubmit,
  isSignedIn,
  phoneSettings,
  t,
  point,
  category,
  setCategory,
  severity,
  setSeverity
}) {
  const layout = usePhoneLayout(phoneSettings);
  const reportCategories = [
    { key: 'incident', labelKey: 'reportCategory.incident', icon: 'alert-circle' },
    { key: 'traffic', labelKey: 'reportCategory.traffic', icon: 'car' },
    { key: 'poor_lighting', labelKey: 'reportCategory.poor_lighting', icon: 'moon' },
    { key: 'construction', labelKey: 'reportCategory.construction', icon: 'construct' },
    { key: 'crowd', labelKey: 'reportCategory.crowd', icon: 'people' },
    { key: 'underpass', labelKey: 'reportCategory.underpass', icon: 'trail-sign' }
  ];

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { paddingBottom: layout.sheetBottomPadding }]}>
          <Text style={styles.reportTitle}>{t('report.title')}</Text>
          <Text style={styles.reportHint}>
            {isSignedIn
              ? t('report.signedHint')
              : t('report.guestHint')}
          </Text>
          <Text style={styles.reportPointText}>
            {point?.title || t('report.point')} · {Number(point?.lat).toFixed(5)}, {Number(point?.lng).toFixed(5)}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reportCategoryRow}>
            {reportCategories.map((item) => {
              const active = category === item.key;
              return (
                <Pressable key={item.key} style={[styles.reportCategoryChip, active && styles.reportCategoryChipActive]} onPress={() => setCategory(item.key)}>
                  <Ionicons name={item.icon} size={15} color={active ? colors.surface : colors.muted} />
                  <Text style={[styles.reportCategoryText, active && styles.reportCategoryTextActive]}>{t(item.labelKey)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.riskLevel}>
            <Text style={styles.settingLabel}>{t('report.danger', { level: severity })}</Text>
            <View style={styles.levelRow}>
              {[1, 2, 3, 4, 5].map((level) => (
                <Pressable
                  key={level}
                  style={[styles.levelButton, severity === level && styles.levelButtonActive]}
                  onPress={() => setSeverity(level)}
                >
                  <Text style={[styles.levelText, severity === level && styles.levelTextActive]}>{level}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={t('report.placeholder')}
            placeholderTextColor={colors.muted}
            multiline
            style={styles.reportInput}
          />
          <View style={styles.reportActions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>{t('auth.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={onSubmit}>
              <Text style={styles.primaryButtonText}>{t('report.send')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BottomTabs({ screen, setScreen, phoneSettings, t }) {
  const layout = usePhoneLayout(phoneSettings);
  const tabs = [
    { key: 'map', labelKey: 'tab.map', icon: 'map' },
    { key: 'profile', labelKey: 'tab.profile', icon: 'person' },
    { key: 'settings', labelKey: 'tab.settings', icon: 'settings' },
  ];
  const tabHeight = phoneSettings.largeTouchTargets ? 66 : 58;

  return (
    <View style={[styles.tabs, { bottom: layout.tabBottom, height: tabHeight }]}>
      {tabs.map((tab) => {
        const active = screen === tab.key;
        return (
          <Pressable key={tab.key} style={[styles.tabButton, { height: tabHeight - 8 }]} onPress={() => setScreen(tab.key)}>
            <Ionicons name={tab.icon} size={21} color={active ? colors.primary : colors.muted} />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{t(tab.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function IconButton({ icon, onPress }) {
  return (
    <Pressable style={styles.iconButton} onPress={onPress}>
      <Ionicons name={icon} size={21} color={colors.ink} />
    </Pressable>
  );
}

function PointRow({ color, title, removable, onRemove }) {
  return (
    <View style={styles.pointRow}>
      <View style={[styles.pointDot, { backgroundColor: color }]} />
      <Text style={styles.pointTitle} numberOfLines={1}>{title}</Text>
      {removable && (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ToggleRow({ label, hint, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.line, true: colors.primarySoft }}
        thumbColor={value ? colors.primary : colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  map: {
    ...StyleSheet.absoluteFillObject
  },
  mapAttribution: {
    position: 'absolute',
    left: 12,
    bottom: 404,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.86)',
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  mapAttributionText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600'
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 42 : 18,
    left: 18,
    right: 18,
    minHeight: 62,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.panel
  },
  searchButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 12
  },
  searchCopy: {
    flex: 1
  },
  searchLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900'
  },
  searchHint: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600'
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0
  },
  city: {
    marginTop: 2,
    fontSize: 13,
    color: colors.muted
  },
  topActions: {
    flexDirection: 'row',
    gap: 10
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line
  },
  mapFabColumn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 128 : 104,
    right: 18,
    alignItems: 'flex-end',
    gap: 10
  },
  mapFabButton: {
    minWidth: 108,
    height: 46,
    borderRadius: 8,
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadows.panel
  },
  mapFabText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '900'
  },
  routeMiniBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.98)',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadows.panel
  },
  routeMiniMain: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8
  },
  routeMiniCopy: {
    flex: 1
  },
  routeMiniTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900'
  },
  routeMiniMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  routeMiniIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas
  },
  bottomPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 86,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.98)',
    padding: 14,
    ...shadows.panel
  },
  bottomPanelCompact: {
    padding: 12
  },
  layerDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 10,
    paddingTop: 10,
    ...shadows.panel
  },
  layerChips: {
    paddingBottom: 10,
    gap: 8
  },
  layerChip: {
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface
  },
  layerChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  layerChipDanger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger
  },
  layerChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800'
  },
  layerChipTextActive: {
    color: colors.surface
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  scoreBadge: {
    width: 64,
    height: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary
  },
  scoreLabel: {
    fontSize: 11,
    color: colors.primary,
    marginTop: -2
  },
  routeTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink
  },
  routeSubtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 14
  },
  closeRouteButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas
  },
  routePrimaryActions: {
    marginTop: 12,
    minHeight: 44,
    flexDirection: 'row',
    gap: 8
  },
  routePrimaryAction: {
    flex: 1.25,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10
  },
  routeStopAction: {
    backgroundColor: colors.danger
  },
  routePrimaryActionText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '900'
  },
  routeSecondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10
  },
  routeSecondaryActionText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900'
  },
  points: {
    marginTop: 14,
    gap: 8
  },
  pointRow: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.canvas
  },
  pointDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  pointTitle: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    fontWeight: '600'
  },
  addWaypointButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  addWaypointText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900'
  },
  segmented: {
    marginTop: 14,
    height: 46,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    padding: 4,
    flexDirection: 'row',
    gap: 4
  },
  segmentButton: {
    flex: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6
  },
  segmentButtonActive: {
    backgroundColor: colors.dark
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13
  },
  segmentTextActive: {
    color: colors.surface
  },
  chips: {
    paddingTop: 12,
    gap: 8
  },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13
  },
  chipTextActive: {
    color: colors.surface
  },
  insights: {
    marginTop: 12,
    gap: 8
  },
  routeOptions: {
    flexDirection: 'row',
    gap: 8
  },
  routeOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  routeOptionActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark
  },
  routeOptionValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900'
  },
  routeOptionLabel: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800'
  },
  routeOptionTextActive: {
    color: colors.surface
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFF8ED'
  },
  safeInsightItem: {
    backgroundColor: colors.primarySoft
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink
  },
  tabs: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    height: 62,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.98)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...shadows.panel
  },
  tabButton: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700'
  },
  tabTextActive: {
    color: colors.primary
  },
  page: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  pageContent: {
    padding: 18,
    paddingBottom: 96,
    gap: 14
  },
  pageTitle: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 0
  },
  profileHero: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line
  },
  phoneHero: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line
  },
  phoneIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: '900'
  },
  profileCopy: {
    flex: 1
  },
  profileName: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900'
  },
  profileMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  metric: {
    width: '48%',
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.ink
  },
  metricLabel: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700'
  },
  authActions: {
    flexDirection: 'row',
    gap: 10
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  primaryButtonWide: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: '900',
    fontSize: 15
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: '900'
  },
  dangerButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBEAE7',
    borderWidth: 1,
    borderColor: '#F2C7BF'
  },
  dangerButtonText: {
    color: colors.danger,
    fontWeight: '900'
  },
  infoBlock: {
    borderRadius: 8,
    padding: 14,
    backgroundColor: colors.primarySoft
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.primary
  },
  infoText: {
    marginTop: 6,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19
  },
  section: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 12
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.ink
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  optionPill: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas
  },
  optionPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark
  },
  optionPillText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 13
  },
  optionPillTextActive: {
    color: colors.surface
  },
  wrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  checkChip: {
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line
  },
  checkChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  checkChipText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 13
  },
  checkChipTextActive: {
    color: colors.surface
  },
  toggleRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  toggleCopy: {
    flex: 1
  },
  settingLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900'
  },
  settingHint: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  riskLevel: {
    gap: 10
  },
  levelRow: {
    flexDirection: 'row',
    gap: 8
  },
  levelButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line
  },
  levelButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  levelText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '900'
  },
  levelTextActive: {
    color: colors.surface
  },
  deviceSettingsButton: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(24,32,27,0.28)'
  },
  sheet: {
    backgroundColor: colors.surface,
    padding: 18,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8
  },
  searchSheet: {
    maxHeight: '86%',
    backgroundColor: colors.surface,
    padding: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  searchInputWrap: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700'
  },
  searchClose: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line
  },
  searchResultHeader: {
    marginTop: 16,
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  placePreview: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    padding: 12
  },
  placePreviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  searchResults: {
    marginTop: 8
  },
  searchResultCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 10,
    marginBottom: 10
  },
  searchResultMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft
  },
  resultTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900'
  },
  resultSubtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  resultActions: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  smallActionButton: {
    height: 34,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line
  },
  smallActionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900'
  },
  primarySmallAction: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  primarySmallActionText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '900'
  },
  smallIconAction: {
    width: 38,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8ED',
    borderWidth: 1,
    borderColor: '#F5D4A1'
  },
  emptySearchText: {
    paddingVertical: 18,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.ink
  },
  reportHint: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted
  },
  reportPointText: {
    marginTop: 10,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800'
  },
  reportCategoryRow: {
    paddingTop: 12,
    gap: 8
  },
  reportCategoryChip: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  reportCategoryChipActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger
  },
  reportCategoryText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900'
  },
  reportCategoryTextActive: {
    color: colors.surface
  },
  input: {
    marginTop: 12,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 15,
    backgroundColor: colors.canvas
  },
  reportInput: {
    marginTop: 14,
    minHeight: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    textAlignVertical: 'top',
    color: colors.ink,
    fontSize: 15,
    backgroundColor: colors.canvas
  },
  reportActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10
  },
  linkButton: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center'
  },
  linkText: {
    color: colors.accent,
    fontWeight: '900'
  }
});

