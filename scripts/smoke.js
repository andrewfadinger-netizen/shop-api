// Проверочный прогон ВСЕХ CRUD-запросов против запущенного сервера: npm run smoke
// Создаёт свои тестовые записи и в конце удаляет их — данные из seed не трогает.
// Используется и в автотесте (test/api.test.js).

const DEFAULT_BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function runSmoke(base = DEFAULT_BASE, { log = console.log } = {}) {
  const results = [];
  const s = Date.now().toString(36); // уникальный суффикс, чтобы прогон можно было повторять

  async function call(method, path, body, expected, note) {
    const init = { method, headers: {} };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(base + path, init);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    const ok = res.status === expected;
    results.push({ ok, method, path, status: res.status, expected, note });
    const tail = ok ? '' : `  <-- ожидали ${expected}: ${text.slice(0, 300)}`;
    log(`${ok ? 'OK ' : 'ERR'} ${res.status} ${method.padEnd(6)} ${path} — ${note}${tail}`);
    return json;
  }

  function check(cond, note) {
    results.push({ ok: Boolean(cond), method: 'CHECK', note });
    log(`${cond ? 'OK ' : 'ERR'}     проверка: ${note}`);
  }

  const missingId = '64b000000000000000000000';
  let r;

  // ---------- Служебное ----------
  r = await call('GET', '/api/health', undefined, 200, 'сервер и БД доступны');
  check(r?.db === 'connected', 'health.db = connected');

  // ---------- Категории ----------
  r = await call('GET', '/api/categories?page=1&limit=2&sort=name', undefined, 200, 'список категорий, пагинация');
  check(r?.data?.length <= 2 && r?.meta?.limit === 2 && r?.meta?.total >= 1, 'meta.limit=2, data ≤ 2, total ≥ 1');

  r = await call('POST', '/api/categories', { name: `Тест-категория ${s}`, slug: `test-${s}`, description: 'Создана smoke-тестом' }, 201, 'создать категорию');
  const catId = r?.data?._id;
  await call('POST', '/api/categories', { name: `тест-категория ${s}`, slug: `test-${s}-2` }, 409, 'дубль названия (без учёта регистра)');
  r = await call('POST', '/api/categories', { name: 'A', slug: 'Плохой slug' }, 400, 'валидация: короткое имя и плохой slug');
  check(r?.error?.details?.name && r?.error?.details?.slug, 'в details есть ошибки name и slug');
  r = await call('GET', `/api/categories/${catId}`, undefined, 200, 'получить категорию по id');
  check(r?.data?.productCount === 0, 'productCount = 0 (виртуальный populate)');
  r = await call('GET', `/api/categories?q=${encodeURIComponent(`тест-категория ${s}`)}`, undefined, 200, 'поиск категории ?q=');
  check(r?.meta?.total === 1, 'найдена ровно 1 категория');
  r = await call('PATCH', `/api/categories/${catId}`, { description: 'Обновлено' }, 200, 'изменить категорию');
  check(r?.data?.description === 'Обновлено', 'описание обновилось');
  await call('PATCH', `/api/categories/${catId}`, { _id: missingId }, 400, 'нельзя менять _id (белый список полей)');
  await call('GET', '/api/categories/123', undefined, 400, 'некорректный id');
  await call('GET', `/api/categories/${missingId}`, undefined, 404, 'несуществующий id');
  await call('GET', '/api/categories?sort=password', undefined, 400, 'сортировка по запрещённому полю');

  // ---------- Пользователи ----------
  const email = `test.${s}@example.com`;
  r = await call('POST', '/api/users', {
    name: 'Тестовый Покупатель',
    email,
    phone: '+77001234567',
    addresses: [{ label: 'Дом', city: 'Караганда', street: 'ул. Ерубаева, 1', zip: '100000' }],
  }, 201, 'создать пользователя со встроенным адресом');
  const userId = r?.data?._id;
  check(r?.data?.addresses?.[0]?.isDefault === true, 'единственный адрес стал адресом по умолчанию');
  await call('POST', '/api/users', { name: 'Дубль', email: email.toUpperCase() }, 409, 'дубль email (email приводится к нижнему регистру)');
  r = await call('POST', '/api/users', { name: 'Ошибка', email: 'not-an-email', phone: '123' }, 400, 'валидация email и телефона');
  check(r?.error?.details?.email && r?.error?.details?.phone, 'в details есть email и phone');
  r = await call('GET', `/api/users?city=${encodeURIComponent('Караганда')}&q=${encodeURIComponent(email)}`, undefined, 200, 'фильтр по городу во встроенном массиве');
  check(r?.meta?.total === 1, 'найден 1 пользователь');
  r = await call('PATCH', `/api/users/${userId}`, { phone: '+77007654321' }, 200, 'изменить пользователя');
  check(r?.data?.phone === '+77007654321', 'телефон обновился');
  await call('GET', `/api/users/${userId}`, undefined, 200, 'получить пользователя');
  await call('GET', '/api/users?role=superuser', undefined, 400, 'неверное значение фильтра role');

  // ---------- Товары ----------
  const sku = `TEST-${s.toUpperCase()}`;
  r = await call('POST', '/api/products', {
    name: `Тестовый смартфон ${s}`,
    sku,
    price: 99990,
    stock: 5,
    category: catId,
    tags: ['Тест', 'Смартфон'],
    attributes: [{ key: 'Память', value: '128 ГБ' }],
    rating: { avg: 5, count: 1000 },
  }, 201, 'создать товар (ссылка на категорию)');
  const productId = r?.data?._id;
  check(r?.data?.category?.name === `Тест-категория ${s}`, 'category подтянута через populate');
  check(r?.data?.tags?.join() === 'тест,смартфон', 'теги приведены к нижнему регистру');
  check(r?.data?.rating?.count === 0, 'rating с клиента проигнорирован (вычисляется сервером)');
  r = await call('POST', '/api/products', { name: 'Без категории', sku: 'NOCAT-1', price: 1, category: missingId }, 400, 'ссылка на несуществующую категорию');
  check(r?.error?.details?.category, 'ошибка в поле category');
  await call('POST', '/api/products', { name: 'Минус', sku: 'MINUS-1', price: -1, category: catId }, 400, 'отрицательная цена');
  r = await call('GET', `/api/products?category=${catId}`, undefined, 200, 'фильтр по категории');
  check(r?.meta?.total === 1 && r?.data?.[0]?.reviews === undefined, '1 товар, в списке нет reviews (проекция)');
  r = await call('GET', '/api/products?minPrice=50000&maxPrice=300000&inStock=true&sort=-price&limit=5', undefined, 200, 'фильтр по цене/наличию + сортировка');
  const prices = (r?.data || []).map((p) => p.price);
  check(prices.length > 0 && prices.every((p, i) => p >= 50000 && p <= 300000 && (i === 0 || prices[i - 1] >= p)), `цены в диапазоне и по убыванию: ${prices.join(', ')}`);
  check(r?.data?.every((p) => p.stock > 0), 'все в наличии');
  r = await call('GET', `/api/products?q=${encodeURIComponent('смартфоны')}`, undefined, 200, 'полнотекстовый поиск (рус. морфология)');
  check(r?.meta?.total >= 1, `найдено товаров: ${r?.meta?.total}`);
  r = await call('GET', '/api/products?tag=android&tag=samsung', undefined, 200, 'фильтр по нескольким тегам');
  check(r?.data?.every((p) => p.tags.includes('android') && p.tags.includes('samsung')), 'у всех есть оба тега');
  await call('GET', '/api/products?minPrice=abc', undefined, 400, 'нечисловой minPrice');
  await call('GET', `/api/products/${productId}`, undefined, 200, 'получить товар');
  r = await call('PATCH', `/api/products/${productId}`, { price: 89990, stock: 3 }, 200, 'изменить цену и остаток');
  check(r?.data?.price === 89990 && r?.data?.stock === 3, 'цена 89990, остаток 3');
  await call('PATCH', `/api/products/${productId}`, { stock: 1.5 }, 400, 'дробный остаток');
  r = await call('GET', `/api/categories/${catId}`, undefined, 200, 'категория после добавления товара');
  check(r?.data?.productCount === 1, 'productCount = 1');
  await call('DELETE', `/api/categories/${catId}`, undefined, 409, 'нельзя удалить категорию с товарами');

  // ---------- Отзывы (встроенные документы) ----------
  await call('POST', `/api/products/${productId}/reviews`, { user: userId, rating: 7 }, 400, 'оценка вне 1–5');
  r = await call('POST', `/api/products/${productId}/reviews`, { user: userId, rating: 5, comment: 'Отлично' }, 201, 'добавить отзыв');
  const reviewId = r?.data?._id;
  check(r?.rating?.avg === 5 && r?.rating?.count === 1, 'rating пересчитан: 5 / 1');
  await call('POST', `/api/products/${productId}/reviews`, { user: userId, rating: 4 }, 409, 'повторный отзыв того же пользователя');
  r = await call('GET', `/api/products/${productId}/reviews`, undefined, 200, 'список отзывов');
  check(r?.data?.length === 1 && r?.data?.[0]?.user?.name === 'Тестовый Покупатель', 'автор отзыва подтянут populate');
  r = await call('PATCH', `/api/products/${productId}/reviews/${reviewId}`, { rating: 4 }, 200, 'изменить отзыв');
  check(r?.rating?.avg === 4, 'rating.avg = 4');
  await call('PATCH', `/api/products/${productId}/reviews/${missingId}`, { rating: 3 }, 404, 'несуществующий отзыв');

  // ---------- Заказы ----------
  r = await call('POST', '/api/orders', { user: userId, items: [{ product: productId, quantity: 2 }] }, 201, 'создать заказ');
  const orderId = r?.data?._id;
  check(r?.data?.total === 179980, `total посчитан сервером: ${r?.data?.total}`);
  check(r?.data?.shippingAddress?.city === 'Караганда', 'адрес взят из профиля (копия)');
  check(r?.data?.items?.[0]?.name === `Тестовый смартфон ${s}` && r?.data?.items?.[0]?.price === 89990, 'name и price скопированы в позицию (snapshot)');
  check(r?.data?.status === 'new', 'статус new');
  r = await call('GET', `/api/products/${productId}`, undefined, 200, 'остаток после заказа');
  check(r?.data?.stock === 1, 'stock: 3 - 2 = 1');
  r = await call('POST', '/api/orders', { user: userId, items: [{ product: productId, quantity: 5 }] }, 409, 'не хватает товара на складе');
  check(r?.error?.details?.available === 1, 'в ответе available = 1');
  await call('POST', '/api/orders', { user: userId, items: [] }, 400, 'пустой заказ');
  await call('POST', '/api/orders', { user: missingId, items: [{ product: productId }] }, 400, 'несуществующий пользователь');
  r = await call('GET', `/api/orders?user=${userId}`, undefined, 200, 'заказы пользователя');
  check(r?.meta?.total === 1 && r?.data?.[0]?.user?.name === 'Тестовый Покупатель', '1 заказ, user подтянут populate');
  r = await call('GET', '/api/orders?status=delivered&sort=-total&limit=3', undefined, 200, 'фильтр по статусу из seed');
  check(r?.data?.every((o) => o.status === 'delivered'), 'все delivered');
  await call('GET', '/api/orders?status=lost', undefined, 400, 'неверный статус в фильтре');
  r = await call('GET', `/api/orders/${orderId}`, undefined, 200, 'получить заказ');
  check(r?.data?.items?.[0]?.product?.sku === sku, 'items.product подтянут populate');
  await call('PATCH', `/api/orders/${orderId}`, { status: 'delivered' }, 409, 'недопустимый переход new -> delivered');
  await call('PATCH', `/api/orders/${orderId}`, { items: [] }, 400, 'состав заказа менять нельзя');
  r = await call('PATCH', `/api/orders/${orderId}`, { status: 'paid', comment: 'Оплачен картой' }, 200, 'оплата: new -> paid');
  check(r?.data?.status === 'paid', 'статус paid');
  r = await call('PATCH', `/api/orders/${orderId}`, { status: 'cancelled' }, 200, 'отмена: paid -> cancelled');
  r = await call('GET', `/api/products/${productId}`, undefined, 200, 'остаток после отмены');
  check(r?.data?.stock === 3, 'товар вернулся на склад: stock = 3');
  await call('DELETE', `/api/users/${userId}`, undefined, 409, 'нельзя удалить пользователя с заказами');
  await call('DELETE', `/api/orders/${orderId}`, undefined, 200, 'удалить заказ');
  await call('GET', `/api/orders/${orderId}`, undefined, 404, 'заказ удалён');

  // ---------- Статистика (aggregation) ----------
  r = await call('GET', '/api/stats/sales-by-category', undefined, 200, 'выручка по категориям');
  check(Array.isArray(r?.data) && r.data.length > 0 && r.data.every((x) => x.revenue > 0), 'есть строки с revenue > 0');
  r = await call('GET', '/api/stats/orders-by-status', undefined, 200, 'заказы по статусам');
  check(Array.isArray(r?.data) && r.data.length > 0, 'есть строки');

  // ---------- Очистка ----------
  r = await call('DELETE', `/api/products/${productId}/reviews/${reviewId}`, undefined, 200, 'удалить отзыв');
  check(r?.rating?.count === 0, 'rating.count = 0');
  await call('DELETE', `/api/products/${productId}`, undefined, 200, 'удалить товар');
  await call('GET', `/api/products/${productId}`, undefined, 404, 'товар удалён');
  await call('DELETE', `/api/categories/${catId}`, undefined, 200, 'удалить пустую категорию');
  await call('DELETE', `/api/users/${userId}`, undefined, 200, 'удалить пользователя без заказов');

  // ---------- Прочие ошибки ----------
  await call('GET', '/api/unknown', undefined, 404, 'несуществующий маршрут');
  await call('POST', '/api/categories', '{"name": ', 400, 'битый JSON');

  const failed = results.filter((x) => !x.ok);
  const requests = results.filter((x) => x.method !== 'CHECK').length;
  log(`\nИтого: запросов ${requests}, проверок ${results.length - requests}, ошибок ${failed.length}`);
  return { results, failed };
}

if (require.main === module) {
  runSmoke()
    .then(({ failed }) => process.exit(failed.length ? 1 : 0))
    .catch((err) => {
      console.error('Smoke-прогон упал:', err.message, `(сервер запущен на ${DEFAULT_BASE}?)`);
      process.exit(1);
    });
}

module.exports = { runSmoke };
