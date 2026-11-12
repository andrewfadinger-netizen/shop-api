const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const crudFactory = require('./crudFactory');
const { has, first, escapeRegex } = require('../utils/query');

module.exports = crudFactory(Category, {
  notFound: 'Категория не найдена',
  allowedFields: ['name', 'slug', 'description'],
  sortable: ['name', 'slug', 'createdAt', 'updatedAt'],
  defaultSort: 'name',

  // ?q=ауд — поиск по названию (регулярка экранируется — защита от ReDoS/инъекций)
  buildFilter(q) {
    const filter = {};
    if (has(q, 'q')) filter.name = { $regex: escapeRegex(first(q.q)), $options: 'i' };
    return filter;
  },

  listPopulate: 'productCount',
  getPopulate: 'productCount',

  // Нельзя удалить категорию, на которую ссылаются товары (целостность ссылок)
  async beforeDelete(category) {
    const count = await Product.countDocuments({ category: category._id });
    if (count > 0) {
      throw ApiError.conflict(`Нельзя удалить категорию: в ней товаров — ${count}`, { products: count });
    }
  },
});
