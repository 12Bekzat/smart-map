# SafeWay: объяснение кода проекта простым языком

Этот документ объясняет, как устроен проект SafeWay: мобильное приложение, backend, база данных, внешние сервисы, настройки и общий путь данных. Текст написан для начинающих: термины используются, но рядом дается короткое объяснение.

## 1. Что делает проект

SafeWay - это прототип мобильного навигатора для Алматы. Его задача не просто построить самый короткий маршрут, а выбрать более безопасный путь.

Приложение умеет:

- показывать карту Алматы;
- искать места и улицы;
- строить маршрут между двумя или несколькими точками;
- учитывать опасные зоны: плохое освещение, ремонт, толпа, подземные переходы, ДТП и другие риски;
- учитывать безопасные объекты: освещенные улицы, людные коридоры, безопасные зоны, транспортные узлы;
- показывать индекс безопасности маршрута;
- принимать пользовательские сообщения о рисках;
- работать как гость или через аккаунт;
- хранить настройки маршрута локально на телефоне и, при входе в аккаунт, в базе данных.

## 2. Общая архитектура

Архитектура - это общая схема, как части проекта связаны между собой.

В проекте есть 3 основные части:

1. **Mobile frontend** - папка `mobile`.
   Это мобильное приложение на React Native и Expo. Пользователь видит карту, кнопки, поиск, профиль и настройки.

2. **Backend API** - папка `backend`.
   Это сервер на Node.js и Express. Он принимает запросы от приложения, работает с базой данных, строит маршруты через OSRM и считает безопасность.

3. **Database** - папка `db`.
   Это PostgreSQL база данных. В ней хранятся риски, безопасные места, пользователи, настройки и отчеты пользователей.

Упрощенный поток данных:

```text
Пользователь нажимает кнопку в приложении
        |
        v
mobile/App.js вызывает функцию из mobile/src/api.js
        |
        v
HTTP-запрос уходит на backend Express
        |
        v
backend читает данные из PostgreSQL и/или OSRM
        |
        v
backend возвращает JSON
        |
        v
mobile обновляет экран, карту и маршрут
```

**HTTP-запрос** - это обычное обращение приложения к серверу через интернет или локальную сеть.

**JSON** - формат данных, похожий на объект JavaScript. Например:

```json
{
  "lat": 43.2495,
  "lng": 76.9459
}
```

## 3. Использованные технологии

### Mobile

- **React Native** - технология для создания мобильных приложений на JavaScript.
- **Expo** - инструмент, который упрощает запуск React Native приложения на телефоне через Expo Go.
- **react-native-maps** - библиотека для карты, маркеров и линий маршрута.
- **expo-location** - библиотека для получения геолокации телефона.
- **AsyncStorage** - локальное хранилище на телефоне. Используется для токена, настроек гостя, избранного.
- **@expo/vector-icons** - иконки в интерфейсе.

### Backend

- **Node.js** - среда, которая запускает JavaScript на сервере.
- **Express** - framework для создания API. Он принимает запросы вроде `GET /health` или `POST /api/routes/safe`.
- **PostgreSQL** - база данных.
- **pg** - библиотека, через которую Node.js подключается к PostgreSQL.
- **Zod** - проверка входных данных. Например, координаты должны быть числами, email должен быть email.
- **JWT** - токен авторизации. После входа пользователь получает токен, и backend понимает, кто делает запрос.
- **bcryptjs** - шифрование паролей. В базе хранится не пароль, а его hash.
- **helmet** - базовые security-заголовки для Express.
- **cors** - разрешает mobile-приложению обращаться к backend.
- **morgan** - логирует HTTP-запросы в терминал.
- **nodemon** - перезапускает backend при изменении файлов во время разработки.

### Database и инфраструктура

- **Docker Compose** - запускает PostgreSQL в контейнере.
- **Migrations** - SQL-файлы, которые создают таблицы.
- **Seeds** - SQL-файлы, которые добавляют демо-данные.
- **OSRM** - внешний сервис маршрутизации. Он строит реальную линию маршрута по дорогам.
- **OpenStreetMap / CARTO** - карта, которая отображается в приложении.
- **Nominatim и Overpass** - внешние OpenStreetMap-сервисы для поиска мест и объектов.

## 4. Структура проекта

```text
smart_maps/
  README.md
  instructions.md
  docker-compose.yml

  mobile/
    App.js
    src/
      api.js
      config.js
      theme.js
      utils.js
    .env
    package.json

  backend/
    src/
      app.js
      server.js
      db/pool.js
      middleware/auth.js
      routes/
      services/
      utils/
    scripts/setup-db.js
    .env
    package.json

  db/
    migrations/
    seeds/

  documentation/
```

## 5. Mobile frontend

Главный файл мобильного приложения:

```text
mobile/App.js
```

В этом файле находится большая часть интерфейса и логики приложения.

### 5.1. Что импортируется в App.js

В начале файла подключаются библиотеки:

- `AsyncStorage` - сохранить данные на телефоне;
- `Location` - получить координаты телефона;
- `useState`, `useEffect`, `useMemo`, `useRef` - React hooks;
- `MapView`, `Marker`, `Polyline`, `UrlTile` - карта, точки, линии маршрута и тайлы карты;
- функции API из `mobile/src/api.js`;
- настройки из `mobile/src/config.js`;
- цвета из `mobile/src/theme.js`;
- вспомогательные функции из `mobile/src/utils.js`.

**Hook** - специальная функция React. Например, `useState` хранит состояние экрана: открыт ли поиск, какой маршрут выбран, кто пользователь.

### 5.2. Основные состояния приложения

В `App.js` много `useState`. Самые важные:

- `screen` - какой экран открыт: карта, профиль, настройки телефона;
- `start` и `end` - начальная и конечная точки маршрута;
- `routePoints` - все точки маршрута, включая промежуточные;
- `preferences` - настройки маршрута: пешком, авто, велосипед, что избегать;
- `route` - текущий рекомендованный маршрут;
- `alternatives` - альтернативные маршруты;
- `risks` - опасные зоны из базы;
- `reports` - отчеты пользователей;
- `places` - безопасные места;
- `mapFeatures` - безопасные линии и зоны на карте;
- `visibleLayers` - какие слои карты включены;
- `token` и `user` - данные авторизованного пользователя;
- `phoneSettings` - настройки отображения для телефона.

**Состояние** - это данные, от которых зависит внешний вид приложения. Когда состояние меняется, React перерисовывает экран.

### 5.3. Загрузка приложения

При запуске вызывается функция `bootstrap()`.

Она параллельно запускает:

- `loadSession()` - загружает токен, пользователя и настройки;
- `loadMapData()` - загружает риски, отчеты, места и безопасные объекты с backend;
- `loadPhoneSettings()` - загружает настройки отображения телефона;
- `loadFavorites()` - загружает избранные места.

То есть приложение сразу подготавливает данные для карты.

### 5.4. Работа с картой

Карта создается через:

```text
MapView
```

Внутри карты используются:

- `UrlTile` - загружает фон карты CARTO;
- `Polyline` - рисует линию маршрута;
- `Marker` - показывает точки старта, финиша, рисков, отчетов и безопасных мест.

Основные слои:

- риски;
- пользовательские отчеты;
- полиция;
- больницы;
- освещенные улицы;
- людные коридоры;
- безопасные зоны;
- транспортные узлы.

Пользователь может включать и выключать слои через chips-кнопки на карте.

### 5.5. Построение маршрута

Главная функция построения маршрута:

```text
buildRoute()
```

Она делает несколько шагов:

1. Проверяет, что точки маршрута находятся внутри Алматы.
2. Собирает список того, что пользователь хочет избегать.
3. Вызывает `fetchSafeRoute()` из `mobile/src/api.js`.
4. Отправляет на backend:

```json
{
  "start": { "lat": 43.2495, "lng": 76.9459 },
  "end": { "lat": 43.2341, "lng": 76.9583 },
  "profile": "walk",
  "avoid": ["poor_lighting", "underpass"],
  "departureHour": 22
}
```

5. Получает от backend рекомендованный маршрут и альтернативы.
6. Сохраняет их в состояние `route` и `alternatives`.
7. Подгоняет карту под маршрут через `fitRoute()`.

### 5.6. Настройки маршрута

Настройки хранятся в `preferences`.

Пример настроек:

```js
{
  profile: 'walk',
  avoid: ['poor_lighting', 'underpass'],
  nightRoute: false,
  preferLitStreets: true,
  preferPublicPlaces: true,
  maxRiskLevel: 3,
  routePriority: 'balanced',
  shareReports: true
}
```

Объяснение:

- `profile` - тип передвижения: пешком, авто, велосипед, самокат;
- `avoid` - категории, которых маршрут должен избегать;
- `nightRoute` - строить маршрут как ночной;
- `preferLitStreets` - сильнее избегать темных улиц;
- `maxRiskLevel` - максимальный уровень риска, который пользователь готов принять;
- `routePriority` - приоритет маршрута;
- `shareReports` - разрешение делиться отчетами.

Функция `updatePreferences()` сохраняет настройки:

- локально в `AsyncStorage`;
- на backend, если пользователь вошел в аккаунт.

### 5.7. Геолокация

Геолокация работает через `expo-location`.

Основные функции:

- `useMyLocation()` - поставить старт маршрута в текущую позицию телефона;
- `buildRouteFromMyLocation()` - построить маршрут от текущей позиции до найденного места;
- `openReportAtCurrentLocation()` - открыть форму отчета на текущей позиции;
- `startNavigation()` - начать навигацию и следить за перемещением пользователя.

Перед использованием геолокации приложение просит разрешение у пользователя.

### 5.8. Поиск

Поиск открывается через `SearchModal`.

Когда пользователь вводит текст, вызывается:

```text
runSearch()
```

Она обращается к:

```text
GET /api/search?q=...
```

Backend ищет:

- в локальной базе безопасных мест;
- в локальной базе рисков;
- в `map_features`;
- во внешних OpenStreetMap сервисах Nominatim и Overpass;
- в заранее заданном каталоге улиц.

### 5.9. Отчеты пользователей

Пользователь может отправить отчет о риске.

Форма отчета хранит:

- категорию риска;
- уровень опасности от 1 до 5;
- текст описания;
- координаты.

При отправке вызывается:

```text
sendReport()
```

Запрос идет на:

```text
POST /api/reports
```

Если пользователь вошел в аккаунт, отчет привязывается к его `user_id`. Если не вошел, отчет сохраняется как гостевой.

### 5.10. Авторизация

Приложение поддерживает:

- регистрацию;
- вход;
- выход;
- получение текущего пользователя;
- сохранение настроек пользователя.

Функции находятся в `mobile/src/api.js`:

- `registerUser()`;
- `loginUser()`;
- `fetchMe()`;
- `saveRemotePreferences()`.

После входа backend возвращает JWT token. Mobile сохраняет его в `AsyncStorage` и отправляет в следующих запросах:

```text
Authorization: Bearer TOKEN
```

## 6. Файлы mobile/src

### 6.1. mobile/src/api.js

Это API-клиент приложения.

API-клиент - это слой кода, который знает, как обращаться к backend.

Главная внутренняя функция:

```text
request(path, options)
```

Она:

- берет базовый адрес backend из `config.js`;
- добавляет JSON headers;
- добавляет JWT token, если он передан;
- ставит timeout, чтобы запрос не висел бесконечно;
- пробует fallback URL, если основной адрес недоступен;
- читает JSON-ответ;
- выбрасывает ошибку, если backend вернул ошибку.

Публичные функции:

- `fetchSafeRoute()` - построить безопасный маршрут;
- `fetchRisks()` - получить риски;
- `fetchReports()` - получить отчеты;
- `fetchPlaces()` - получить безопасные места;
- `fetchMapFeatures()` - получить безопасные объекты карты;
- `searchPlaces()` - поиск мест;
- `sendReport()` - отправить отчет;
- `registerUser()` - регистрация;
- `loginUser()` - вход;
- `fetchMe()` - получить текущего пользователя;
- `saveRemotePreferences()` - сохранить настройки пользователя.

### 6.2. mobile/src/config.js

Здесь лежат настройки frontend:

- `API_BASE_URL` - основной адрес backend;
- `API_FALLBACK_URLS` - запасные адреса backend;
- `ALMATY_REGION` - стартовый регион карты;
- `DEFAULT_START` - стартовая точка по умолчанию;
- `DEFAULT_END` - конечная точка по умолчанию.

Файл `mobile/.env` задает:

```env
EXPO_PUBLIC_API_URL=http://IP_КОМПЬЮТЕРА:4000
```

Это нужно, чтобы телефон мог найти backend на компьютере.

### 6.3. mobile/src/theme.js

Здесь лежат цвета и тени интерфейса.

Это удобно, потому что цвета не разбросаны по всему проекту.

### 6.4. mobile/src/utils.js

Здесь лежат маленькие вспомогательные функции:

- `toCoordinate()` - переводит `{ lat, lng }` в формат карты `{ latitude, longitude }`;
- `routeCoordinates()` - превращает geometry маршрута в координаты для `Polyline`;
- `formatDistance()` - красиво форматирует километры;
- `formatDuration()` - красиво форматирует минуты и часы;
- `categoryLabel()` - переводит техническую категорию риска в понятное название.

## 7. Backend

Backend находится в папке:

```text
backend/
```

Главные файлы:

- `src/server.js` - запускает сервер на порту;
- `src/app.js` - создает Express-приложение и подключает routes;
- `src/db/pool.js` - подключение к PostgreSQL;
- `src/routes/*` - endpoints API;
- `src/services/*` - бизнес-логика;
- `src/middleware/auth.js` - авторизация;
- `scripts/setup-db.js` - подготовка базы данных.

**Endpoint** - конкретный адрес API, например `POST /api/routes/safe`.

### 7.1. backend/src/server.js

Этот файл запускает backend:

```js
const port = Number(process.env.PORT || 4000);
app.listen(port)
```

Если порт занят, выводится понятная ошибка.

Порт по умолчанию:

```text
4000
```

### 7.2. backend/src/app.js

Здесь создается Express-приложение:

- подключается `helmet`;
- подключается `cors`;
- включается чтение JSON через `express.json()`;
- подключается логирование `morgan`;
- подключаются все routes.

Routes:

```text
/health
/api/auth
/api/places
/api/risks
/api/map
/api/search
/api/reports
/api/routes
```

Также здесь есть обработчик ошибок. Если Zod нашел неправильные данные, backend возвращает `400 Validation error`.

### 7.3. backend/src/db/pool.js

Создает connection pool к PostgreSQL.

**Connection pool** - набор подключений к базе, которые переиспользуются. Это быстрее, чем каждый раз открывать новое подключение.

Адрес базы берется из:

```env
DATABASE_URL=postgres://postgres:root@localhost:5432/safeway
```

### 7.4. backend/src/middleware/auth.js

Здесь логика авторизации.

Функции:

- `optionalAuth()` - если токен есть, пытается найти пользователя; если токена нет, запрос все равно проходит;
- `requireAuth()` - требует, чтобы пользователь был авторизован;
- `signUserToken()` - создает JWT token для пользователя.

JWT token хранит `sub`, то есть id пользователя.

### 7.5. backend/src/utils/asyncHandler.js

Маленькая обертка для async routes.

Она нужна, чтобы ошибки из `async` функций попадали в общий обработчик ошибок Express.

### 7.6. backend/src/utils/almaty.js

Здесь задана зона обслуживания Алматы:

```text
lat: 43.12 - 43.39
lng: 76.78 - 77.12
```

Функция `assertInsideAlmaty()` выбрасывает ошибку, если точка вне этой зоны.

## 8. Backend routes

### 8.1. /health

Файл:

```text
backend/src/routes/health.js
```

Endpoint:

```text
GET /health
```

Проверяет, что backend работает и база данных отвечает.

Ответ примерно такой:

```json
{
  "ok": true,
  "database": true,
  "now": "2026-05-10T..."
}
```

### 8.2. /api/auth

Файл:

```text
backend/src/routes/auth.js
```

Endpoints:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
GET  /api/auth/preferences
PUT  /api/auth/preferences
```

Регистрация:

1. Zod проверяет имя, email, пароль.
2. Backend проверяет, нет ли такого email.
3. Пароль хешируется через bcrypt.
4. Создается пользователь в таблице `users`.
5. Создаются настройки в `user_preferences`.
6. Backend возвращает пользователя, token и preferences.

Вход:

1. Backend ищет пользователя по email.
2. Сравнивает пароль через bcrypt.
3. Объединяет настройки из базы и настройки, пришедшие с телефона.
4. Возвращает пользователя, token и preferences.

### 8.3. /api/routes/safe

Файл:

```text
backend/src/routes/routes.js
```

Главный endpoint проекта:

```text
POST /api/routes/safe
```

Он строит безопасный маршрут.

Порядок работы:

1. Zod проверяет тело запроса.
2. Backend проверяет, что все точки внутри Алматы.
3. Из базы загружаются активные риски.
4. Из базы загружаются безопасные объекты карты.
5. Backend вызывает OSRM для построения маршрута.
6. Если OSRM недоступен, используется fallback route.
7. Маршруты передаются в `scoreRoutes()`.
8. Backend возвращает лучший маршрут и альтернативы.

Ответ содержит:

- `recommended` - лучший маршрут;
- `alternatives` - другие варианты;
- `meta` - дополнительная информация: профиль, время, был ли fallback.

### 8.4. /api/reports

Файл:

```text
backend/src/routes/reports.js
```

Endpoints:

```text
GET  /api/reports
POST /api/reports
```

`GET` возвращает последние отчеты пользователей.

`POST` создает новый отчет:

- категория;
- уровень опасности;
- описание;
- координаты;
- `user_id`, если пользователь вошел.

Статус нового отчета по умолчанию:

```text
pending
```

То есть отчет ожидает проверки.

### 8.5. /api/search

Файл:

```text
backend/src/routes/search.js
```

Endpoint:

```text
GET /api/search?q=...
```

Ищет места по запросу пользователя.

Источники поиска:

- `safe_places` в базе;
- `map_features` в базе;
- `risk_zones` в базе;
- локальный список улиц;
- Nominatim;
- Overpass.

Результаты объединяются и очищаются от дублей.

### 8.6. /api/places

Файл:

```text
backend/src/routes/places.js
```

Endpoints:

```text
GET /api/places
GET /api/places?lat=...&lng=...&radius=...
```

Без координат возвращает все безопасные места.

С координатами возвращает ближайшие места в заданном радиусе.

### 8.7. /api/risks

Файл:

```text
backend/src/routes/risks.js
```

Endpoints:

```text
GET /api/risks
GET /api/risks/nearby?lat=...&lng=...&radius=...
```

Возвращает опасные зоны. `nearby` ищет риски рядом с точкой.

### 8.8. /api/map/features

Файл:

```text
backend/src/routes/mapFeatures.js
```

Endpoint:

```text
GET /api/map/features
```

Возвращает дополнительные объекты карты:

- освещенные улицы;
- людные коридоры;
- безопасные зоны;
- транспортные узлы;
- тихие зоны.

Можно фильтровать по категории:

```text
GET /api/map/features?category=lit_street,safe_zone
```

## 9. Backend services

Services - это файлы с бизнес-логикой. Они не отвечают напрямую на HTTP-запросы, а выполняют важные вычисления.

### 9.1. backend/src/services/osrm.js

Этот файл отвечает за построение маршрута через OSRM.

Главные функции:

- `getOsrmRoutes()` - строит маршруты между двумя точками;
- `getOsrmRouteThroughWaypoints()` - строит маршрут через несколько точек;
- `getFallbackRoute()` - создает простой запасной маршрут, если OSRM недоступен;
- `combineRouteLegs()` - объединяет несколько частей маршрута в один.

Профили переводятся так:

```text
walk    -> foot
drive   -> driving
bike    -> bike
scooter -> bike
```

Внутри есть cache.

**Cache** - временное хранение результата. Если такой же маршрут уже недавно строился, backend не спрашивает OSRM заново.

### 9.2. backend/src/services/safetyScoring.js

Этот файл считает безопасность маршрута.

Главная функция:

```text
scoreRoutes()
```

Она получает:

- маршруты;
- риски;
- безопасные объекты;
- тип передвижения;
- час отправления;
- список категорий, которых нужно избегать.

Для каждого маршрута она:

1. Ищет близкие риски.
2. Ищет близкие безопасные объекты.
3. Считает штрафы за риски.
4. Считает бонусы за безопасные объекты.
5. Выдает `safetyScore` от 1 до 100.
6. Сортирует маршруты: сначала безопаснее, потом быстрее.

Формула в простом виде:

```text
100 - штрафы за риски - небольшой штраф за профиль + бонусы за безопасные объекты
```

Если ночью маршрут проходит рядом с плохим освещением, штраф становится больше.

### 9.3. backend/src/services/defaultPreferences.js

Здесь лежат настройки маршрута по умолчанию.

Функция `mergePreferences()` объединяет пользовательские настройки с дефолтными. Это нужно, чтобы не потерять поля, если часть настроек отсутствует.

## 10. База данных

SQL-файлы находятся в:

```text
db/migrations
db/seeds
```

### 10.1. migrations

**Migration** - файл, который создает или изменяет структуру базы данных.

В проекте есть:

- `001_init.sql` - основные таблицы: риски, безопасные места, отчеты, пользователи, настройки;
- `002_auth_preferences.sql` - таблицы и связи для авторизации и настроек;
- `003_map_features.sql` - таблица объектов карты.

### 10.2. seeds

**Seed** - файл с начальными демо-данными.

В проекте есть:

- `001_almaty_seed.sql` - демо-риски и безопасные места Алматы;
- `002_map_features_seed.sql` - демо-объекты карты.

### 10.3. Основные таблицы

#### risk_zones

Опасные зоны.

Поля:

- `id` - уникальный id;
- `title` - название;
- `category` - категория риска;
- `severity` - серьезность от 1 до 5;
- `radius_m` - радиус действия риска в метрах;
- `description` - описание;
- `lat`, `lng` - координаты;
- `active` - активен ли риск;
- `verified` - проверен ли риск.

#### safe_places

Безопасные места.

Типы:

- `police`;
- `hospital`;
- `metro`;
- `mall`;
- `transport`;
- `public`.

#### user_reports

Отчеты пользователей.

Содержит категорию, описание, координаты, статус и, если есть, `user_id`.

#### users

Пользователи.

Важное поле:

```text
password_hash
```

Здесь хранится не настоящий пароль, а hash.

**Hash** - результат одностороннего преобразования. По нему нельзя нормально восстановить исходный пароль.

#### user_preferences

Настройки пользователя.

Поле `settings` имеет тип `JSONB`.

**JSONB** - формат PostgreSQL для хранения JSON-данных в базе.

#### map_features

Объекты карты, влияющие на безопасность:

- освещенные улицы;
- людные коридоры;
- безопасные зоны;
- тихие зоны;
- транспортные узлы.

Поле `geometry` хранит массив координат.

## 11. Docker Compose

Файл:

```text
docker-compose.yml
```

Он запускает PostgreSQL:

```yaml
image: postgres:16
container_name: safeway_postgres
ports:
  - "5432:5432"
```

Также он подключает migrations и seed-файл при первом создании контейнера.

Данные PostgreSQL сохраняются в volume:

```text
safeway_pgdata
```

**Volume** - место, где Docker хранит данные, чтобы они не пропали после остановки контейнера.

## 12. Переменные окружения

**Переменные окружения** - настройки, которые не зашиты напрямую в код.

### backend/.env

```env
PORT=4000
DATABASE_URL=postgres://postgres:root@localhost:5432/safeway
OSRM_BASE_URL=https://router.project-osrm.org
JWT_SECRET=change-this-dev-secret
```

Объяснение:

- `PORT` - порт backend;
- `DATABASE_URL` - адрес PostgreSQL;
- `OSRM_BASE_URL` - адрес сервиса маршрутизации;
- `JWT_SECRET` - секрет для подписи токенов.

### mobile/.env

```env
EXPO_PUBLIC_API_URL=http://IP_КОМПЬЮТЕРА:4000
```

Если телефон запускает приложение через Expo Go по Wi-Fi, здесь должен быть IP компьютера в той же сети.

## 13. Как работает построение безопасного маршрута

Полный сценарий:

1. Пользователь выбирает старт и финиш.
2. Mobile вызывает `buildRoute()`.
3. `buildRoute()` вызывает `fetchSafeRoute()`.
4. `fetchSafeRoute()` отправляет `POST /api/routes/safe`.
5. Backend проверяет данные через Zod.
6. Backend проверяет, что точки внутри Алматы.
7. Backend получает риски из `risk_zones` и `user_reports`.
8. Backend получает безопасные объекты из `map_features`.
9. Backend вызывает OSRM и получает геометрию маршрута.
10. `scoreRoutes()` считает штрафы и бонусы.
11. Backend возвращает лучший маршрут.
12. Mobile рисует маршрут на карте через `Polyline`.
13. Mobile показывает индекс безопасности, расстояние, время, риски и безопасные места рядом.

## 14. Как работает авторизация

Регистрация:

```text
Mobile -> POST /api/auth/register -> Backend -> PostgreSQL
```

Backend:

1. Проверяет данные.
2. Проверяет уникальность email.
3. Хеширует пароль.
4. Создает пользователя.
5. Создает настройки.
6. Возвращает JWT token.

Вход:

```text
Mobile -> POST /api/auth/login -> Backend -> PostgreSQL
```

Backend:

1. Находит пользователя по email.
2. Сравнивает пароль.
3. Обновляет настройки.
4. Возвращает token.

Дальше mobile отправляет token в защищенных запросах:

```text
Authorization: Bearer TOKEN
```

## 15. Как работает гостевой режим

Если пользователь не вошел:

- приложение все равно работает;
- маршрут можно строить;
- настройки сохраняются в `AsyncStorage`;
- отчеты можно отправлять;
- отчеты не привязаны к аккаунту.

Если пользователь входит:

- guest-настройки отправляются на backend;
- backend объединяет их с настройками аккаунта;
- новые настройки хранятся в `user_preferences`.

## 16. Как работает поиск

Когда пользователь вводит запрос:

```text
Mobile -> GET /api/search?q=текст
```

Backend ищет в нескольких местах одновременно:

- безопасные места в базе;
- безопасные объекты карты;
- риски;
- локальный список улиц;
- Nominatim;
- Overpass.

Потом результаты объединяются, дубли удаляются, и mobile получает максимум 15 результатов.

## 17. Как работает отправка отчета

Сценарий:

1. Пользователь нажимает кнопку события или долго нажимает на карту.
2. Открывается `ReportModal`.
3. Пользователь выбирает категорию и опасность.
4. Mobile отправляет `POST /api/reports`.
5. Backend проверяет координаты и данные.
6. Backend сохраняет отчет в `user_reports`.
7. Mobile добавляет отчет на карту.

## 18. Основные API endpoints

```text
GET  /health

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
GET  /api/auth/preferences
PUT  /api/auth/preferences

GET  /api/places
GET  /api/places?lat=...&lng=...&radius=...

GET  /api/risks
GET  /api/risks/nearby?lat=...&lng=...&radius=...

GET  /api/map/features
GET  /api/search?q=...

GET  /api/reports
POST /api/reports

POST /api/routes/safe
```

## 19. Команды запуска

### Установить зависимости backend

```powershell
cd C:\Users\toleu\Desktop\smart_maps\backend
npm install
```

### Запустить PostgreSQL

```powershell
cd C:\Users\toleu\Desktop\smart_maps
docker compose up -d postgres
```

### Подготовить базу

```powershell
cd C:\Users\toleu\Desktop\smart_maps\backend
npm run db:setup
```

### Запустить backend

```powershell
cd C:\Users\toleu\Desktop\smart_maps\backend
npm run dev
```

### Установить зависимости mobile

```powershell
cd C:\Users\toleu\Desktop\smart_maps\mobile
npm install
```

### Запустить mobile

```powershell
cd C:\Users\toleu\Desktop\smart_maps\mobile
npm start
```

Для Android:

```powershell
npm run android
```

Для iOS через Expo:

```powershell
npm run ios
```

## 20. Проверки проекта

Backend:

```powershell
cd C:\Users\toleu\Desktop\smart_maps\backend
npm run check
```

Mobile:

```powershell
cd C:\Users\toleu\Desktop\smart_maps\mobile
npx expo-doctor
```

Можно также проверить сборку Expo:

```powershell
npx expo export --platform android --output-dir dist-check
```

## 21. Что важно понимать по коду

1. **Frontend не строит маршрут сам.**
   Он только отправляет точки на backend и рисует результат.

2. **Backend не хранит карту.**
   Карта приходит из CARTO/OpenStreetMap, а backend хранит только свои данные: риски, места, отчеты, настройки.

3. **OSRM строит геометрию маршрута.**
   Backend добавляет поверх нее расчет безопасности.

4. **PostgreSQL хранит постоянные данные.**
   Если закрыть приложение, данные в базе остаются.

5. **AsyncStorage хранит локальные данные телефона.**
   Например, гостевые настройки и token.

6. **JWT token нужен для понимания, кто пользователь.**
   Без token backend не может связать запрос с аккаунтом.

7. **Zod защищает backend от неправильных данных.**
   Например, нельзя отправить координаты как текст вместо чисел.

8. **Fallback route нужен на случай проблем с OSRM.**
   Если внешний сервис недоступен, приложение все равно может показать примерный маршрут.

## 22. Где искать нужную логику

```text
Интерфейс карты:
mobile/App.js

Запросы mobile к backend:
mobile/src/api.js

Адрес backend для mobile:
mobile/src/config.js
mobile/.env

Запуск backend:
backend/src/server.js

Подключение routes:
backend/src/app.js

Построение безопасного маршрута:
backend/src/routes/routes.js
backend/src/services/osrm.js
backend/src/services/safetyScoring.js

Авторизация:
backend/src/routes/auth.js
backend/src/middleware/auth.js

Отчеты:
backend/src/routes/reports.js

Поиск:
backend/src/routes/search.js

База данных:
db/migrations
db/seeds
```

## 23. Короткое объяснение проекта одной фразой

SafeWay - это Expo/React Native мобильное приложение, которое через Express backend обращается к PostgreSQL и OSRM, строит маршрут по Алматы, оценивает его по рискам и безопасным объектам, затем показывает пользователю более безопасный вариант на карте.
