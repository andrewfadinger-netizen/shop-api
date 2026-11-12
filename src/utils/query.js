const mongoose = require('mongoose');
const ApiError = require('./ApiError');

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const MAX_LIMIT = 100;

// ?tag=a&tag=b приходит массивом — для одиночных параметров берём первое значение
const first = (value) => (Array.isArray(value) ? value[0] : value);
const has = (query, key) => query[key] !== undefined && query[key] !== '';

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toNumber(value, name) {
  const n = Number(first(value));
  if (!Number.isFinite(n)) throw ApiError.badRequest(`Параметр «${name}» должен быть числом`);
  return n;
}

function toBool(value, name) {
  const v = String(first(value)).toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  throw ApiError.badRequest(`Параметр «${name}» должен быть true или false`);
}

function toObjectId(value, name) {
  const v = String(first(value) ?? '');
  if (!OBJECT_ID_RE.test(v)) throw ApiError.badRequest(`Поле «${name}» должно быть корректным ObjectId`);
  return new mongoose.Types.ObjectId(v);
}

function toDate(value, name) {
  const d = new Date(String(first(value)));
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest(`Параметр «${name}» должен быть датой (YYYY-MM-DD)`);
  return d;
}

// "-price,name" -> { price: -1, name: 1, _id: 1 }. Поля — только из белого списка.
function parseSort(value, sortable) {
  const sort = {};
  for (const raw of String(first(value)).split(',')) {
    const token = raw.trim();
    if (!token) continue;
    const field = token.replace(/^[-+]/, '');
    if (!sortable.includes(field)) {
      throw ApiError.badRequest(`Сортировка по полю «${field}» не поддерживается`, { allowed: sortable });
    }
    sort[field] = token.startsWith('-') ? -1 : 1;
  }
  if (!('_id' in sort)) sort._id = 1; // стабильный порядок между страницами
  return sort;
}

function parsePagination(query, { defaultSort, sortable }) {
  const page = Math.max(1, parseInt(first(query.page), 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(first(query.limit), 10) || 10));
  const sort = parseSort(has(query, 'sort') ? query.sort : defaultSort, sortable);
  return { page, limit, skip: (page - 1) * limit, sort };
}

// Берём из тела запроса только разрешённые поля (защита от подмены _id, rating и т.п.)
function pick(obj, fields) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(obj, f)) out[f] = obj[f];
  }
  return out;
}

module.exports = {
  OBJECT_ID_RE,
  first,
  has,
  escapeRegex,
  toNumber,
  toBool,
  toObjectId,
  toDate,
  parseSort,
  parsePagination,
  pick,
};
