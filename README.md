# Shop API — интернет-магазин электроники (Express + Mongoose + MongoDB)

Учебный проект по теме **«Проектирование базы данных и интеграция MongoDB с Backend-приложением»**.

Цели:
1. Изучить методы моделирования данных (embedding / referencing, паттерны snapshot, computed, attribute).
2. Исследовать интеграцию MongoDB и Mongoose (схемы, валидация, индексы, middleware, populate, aggregation).
3. Реализовать CRUD в серверном приложении.

**Предметная область:** интернет-магазин электроники в Казахстане. Покупатели (с адресами) оформляют заказы на товары из категорий и оставляют отзывы.

| Коллекция | Что хранит | Связи |
|---|---|---|
| `categories` | Категории каталога | ← products.category |
| `products` | Товары, встроенные **отзывы** и **характеристики** | → categories (ref), reviews.user → users (ref) |
| `users` | Покупатели, встроенные **адреса** | ← orders.user |
| `orders` | Заказы, встроенные **позиции** и **адрес доставки** (копии) | → users (ref), items.product → products (ref) |

ER-диаграмма, обоснование embedding/referencing и список индексов — в [docs/data-model.md](docs/data-model.md).

## Стек

- Node.js ≥ 20.12 (проверено на 24.21), Express 5, Mongoose 9
- MongoDB 8+ (проверено на службе MongoDB 9.0 под Windows; подойдёт и MongoDB Atlas), MongoDB Compass для просмотра
- Тесты: `node:test` + `mongodb-memory-server` (временная БД в памяти)

## Структура

```
src/
  config.js            переменные окружения (.env)
  db.js                подключение к MongoDB
  app.js               Express-приложение, маршруты, обработка ошибок
  server.js            запуск сервера, корректное завершение
  models/              схемы Mongoose: Category, Product, User, Order, schemas/address
  controllers/         crudFactory (общий CRUD) + логика каждой сущности, statsController
  routes/index.js      маршруты /api/*
  middleware/          validateId (проверка ObjectId), errorHandler (единый формат ошибок)
  utils/               ApiError, разбор query-параметров (пагинация, сортировка, фильтры)
scripts/
  seed.js, seed-data.js  тестовые данные
  smoke.js               прогон всех запросов против запущенного сервера
test/api.test.js       автотест (seed + все сценарии на временной БД)
requests.http          все запросы для VS Code REST Client
postman/               Postman-коллекция (импорт в Postman)
docs/                  модель данных, лог проверочного прогона
```

## Запуск

### 1. Установить MongoDB

**Вариант А — локально (Windows):** установить [MongoDB Community Server](https://www.mongodb.com/try/download/community) как службу и [MongoDB Compass](https://www.mongodb.com/try/download/compass). Или через winget:

```bash
winget install MongoDB.Server
```

```bash
winget install MongoDB.Compass.Full
```

**Вариант Б — MongoDB Atlas:** создать бесплатный кластер M0, пользователя БД, разрешить свой IP, скопировать строку подключения `mongodb+srv://...` в `.env`.

### 2. Установить зависимости и настроить окружение

```bash
npm install
```

```bash
copy .env.example .env
```

В `.env` при необходимости поменять `MONGODB_URI` (по умолчанию `mongodb://127.0.0.1:27017/shop_db`).

### 3. Заполнить базу и запустить сервер

```bash
npm run seed
```

```bash
npm start
```

Сервер: http://localhost:3000. Режим разработки с автоперезапуском — `npm run dev`.

> Если в консоли Windows русский текст выглядит «кракозябрами», выполните `chcp 65001`.

### 4. Проверить

```bash
npm run smoke
```

прогоняет 64 запроса и 38 проверок против запущенного сервера (создаёт свои записи и удаляет их — seed-данные не трогает). Лог последнего прогона — [docs/smoke-run.txt](docs/smoke-run.txt).

```bash
npm test
```

автотест на временной БД в памяти (живая БД не нужна).

### 5. Открыть базу в MongoDB Compass

Подключение `mongodb://127.0.0.1:27017` → база `shop_db` → коллекции `categories`, `products`, `users`, `orders`. Вкладка **Indexes** показывает индексы из схем, **Schema** — структуру документов.

## API

Базовый URL: `http://localhost:3000/api`

| Сущность | Список | Один | Создать | Изменить | Удалить |
|---|---|---|---|---|---|
| Категории | `GET /categories` | `GET /categories/:id` | `POST /categories` | `PATCH /categories/:id` | `DELETE /categories/:id` |
| Товары | `GET /products` | `GET /products/:id` | `POST /products` | `PATCH /products/:id` | `DELETE /products/:id` |
| Отзывы (встроенные) | `GET /products/:id/reviews` | — | `POST /products/:id/reviews` | `PATCH /products/:id/reviews/:reviewId` | `DELETE /products/:id/reviews/:reviewId` |
| Пользователи | `GET /users` | `GET /users/:id` | `POST /users` | `PATCH /users/:id` | `DELETE /users/:id` |
| Заказы | `GET /orders` | `GET /orders/:id` | `POST /orders` | `PATCH /orders/:id` | `DELETE /orders/:id` |

Дополнительно: `GET /api/health`, `GET /api/stats/sales-by-category`, `GET /api/stats/orders-by-status` (aggregation pipeline).

### Пагинация и сортировка (для всех списков)

`?page=2&limit=10&sort=-price,name` — `limit` от 1 до 100 (по умолчанию 10), `-` перед полем — по убыванию. Сортировать можно только по разрешённым полям (иначе 400).

Ответ списка:

```json
{ "data": [ ... ], "meta": { "page": 1, "limit": 2, "total": 12, "pages": 6 } }
```

### Фильтры

| Ресурс | Параметры |
|---|---|
| `/categories` | `q` — поиск по названию |
| `/products` | `category`, `minPrice`, `maxPrice`, `inStock=true/false`, `tag` (можно несколько), `minRating`, `isActive`, `q` — полнотекстовый поиск |
| `/users` | `role`, `q` — по имени/email, `city` — по городу во встроенных адресах; `GET /users/:id?include=orders` — с заказами |
| `/orders` | `status`, `user`, `from`, `to` (YYYY-MM-DD), `minTotal`, `maxTotal` |

### Бизнес-правила

- **Заказ:** сервер сам берёт цены и названия из товаров (копия), считает `total`, списывает остаток атомарно; если товара не хватает — 409 и откат. Адрес доставки — из запроса или адрес пользователя по умолчанию.
- **Статусы заказа:** `new → paid → shipped → delivered`, отмена `cancelled` возможна из `new` и `paid` (товары возвращаются на склад). Другие переходы — 409.
- Нельзя удалить категорию с товарами и пользователя с заказами (409).
- `rating` товара считается сервером по отзывам; один пользователь — один отзыв на товар.
- Из тела запроса берутся только разрешённые поля (нельзя подменить `_id`, `rating`, `total`).

### Формат ошибок

```json
{ "error": { "status": 400, "message": "Ошибка валидации", "details": { "price": "Цена не может быть отрицательной" } } }
```

| Код | Когда |
|---|---|
| 400 | Ошибка валидации, некорректный ObjectId, неверный параметр фильтра, битый JSON |
| 404 | Документ или маршрут не найден |
| 409 | Дубликат (unique-индекс), недопустимый переход статуса, нехватка товара, удаление связанной записи |
| 500 | Непредвиденная ошибка сервера |

### Примеры

Создать заказ:

```http
POST /api/orders
Content-Type: application/json

{ "user": "<id пользователя>", "items": [{ "product": "<id товара>", "quantity": 2 }] }
```

Выручка по категориям (`GET /api/stats/sales-by-category`) на seed-данных:

| Категория | Выручка, ₸ | Продано шт. | Заказов |
|---|---|---|---|
| Смартфоны | 869 960 | 4 | 3 |
| Ноутбуки | 839 980 | 2 | 2 |
| Аудио | 254 970 | 3 | 3 |
| Аксессуары | 135 950 | 5 | 4 |

Все остальные запросы — в [requests.http](requests.http) и [postman/shop-api.postman_collection.json](postman/shop-api.postman_collection.json) (в Postman: Import → файл → Run collection; id сохраняются в переменные коллекции автоматически).

## Скрипты

| Команда | Что делает |
|---|---|
| `npm start` | запуск сервера |
| `npm run dev` | запуск с автоперезапуском (`node --watch`) |
| `npm run seed` | очистить коллекции и заполнить тестовыми данными (4 категории, 12 товаров, 6 пользователей, 8 заказов) |
| `npm run smoke` | проверить все запросы против запущенного сервера |
| `npm test` | автотест на временной БД |
