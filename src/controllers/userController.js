const User = require('../models/User');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const crudFactory = require('./crudFactory');
const { has, first, escapeRegex } = require('../utils/query');

module.exports = crudFactory(User, {
  notFound: 'Пользователь не найден',
  allowedFields: ['name', 'email', 'phone', 'role', 'addresses'],
  sortable: ['name', 'email', 'role', 'createdAt', 'updatedAt'],
  defaultSort: 'name',

  buildFilter(q) {
    const filter = {};
    if (has(q, 'role')) {
      const role = String(first(q.role));
      if (!User.ROLES.includes(role)) throw ApiError.badRequest(`role: ${User.ROLES.join(' или ')}`);
      filter.role = role;
    }
    if (has(q, 'q')) {
      const re = { $regex: escapeRegex(first(q.q)), $options: 'i' };
      filter.$or = [{ name: re }, { email: re }];
    }
    // Запрос по полю встроенного массива: пользователи, у которых есть адрес в городе
    if (has(q, 'city')) {
      filter['addresses.city'] = { $regex: `^${escapeRegex(first(q.city))}$`, $options: 'i' };
    }
    return filter;
  },

  // GET /api/users/:id?include=orders — подтянуть заказы через виртуальный populate
  getPopulate: (req) =>
    req.query.include === 'orders'
      ? { path: 'orders', select: 'status total createdAt', options: { sort: { createdAt: -1 } } }
      : null,

  async beforeDelete(user) {
    const count = await Order.countDocuments({ user: user._id });
    if (count > 0) {
      throw ApiError.conflict(`Нельзя удалить пользователя: у него заказов — ${count}`, { orders: count });
    }
  },
});
