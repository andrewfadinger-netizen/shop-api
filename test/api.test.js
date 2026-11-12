// Автотест: поднимает временный MongoDB в памяти, заполняет seed-данными,
// запускает API на свободном порту и прогоняет все сценарии из scripts/smoke.js.
process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../src/app');
const { seed } = require('../scripts/seed');
const { runSmoke } = require('../scripts/smoke');

let mongod;
let server;
let base;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('shop_test'));
  await seed({ log: () => {} });
  server = createApp().listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) server.close();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test('seed создаёт данные во всех коллекциях', async () => {
  const db = mongoose.connection.db;
  assert.equal(await db.collection('categories').countDocuments(), 4);
  assert.equal(await db.collection('products').countDocuments(), 12);
  assert.equal(await db.collection('users').countDocuments(), 6);
  assert.equal(await db.collection('orders').countDocuments(), 8);
});

test('индексы из схем созданы', async () => {
  const names = (await mongoose.connection.db.collection('products').indexes()).map((i) => i.name);
  for (const n of ['sku_1', 'product_text', 'category_1_price_1']) assert.ok(names.includes(n), `нет индекса ${n}`);
});

test('все CRUD-сценарии API проходят', async () => {
  const { failed } = await runSmoke(base, { log: () => {} });
  assert.deepEqual(failed, [], JSON.stringify(failed, null, 2));
});
