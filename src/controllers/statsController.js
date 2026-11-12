const Order = require('../models/Order');
const Product = require('../models/Product');
const Category = require('../models/Category');

// GET /api/stats/sales-by-category — выручка по категориям (aggregation pipeline + $lookup)
async function salesByCategory(req, res) {
  const data = await Order.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: Product.collection.name,
        localField: 'items.product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$product.category',
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        unitsSold: { $sum: '$items.quantity' },
        orderIds: { $addToSet: '$_id' },
      },
    },
    {
      $lookup: {
        from: Category.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        categoryId: '$_id',
        category: { $ifNull: ['$category.name', 'Без категории (товар удалён)'] },
        revenue: 1,
        unitsSold: 1,
        ordersCount: { $size: '$orderIds' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
  res.json({ data });
}

// GET /api/stats/orders-by-status — количество и сумма заказов по статусам
async function ordersByStatus(req, res) {
  const data = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } },
    { $project: { _id: 0, status: '$_id', count: 1, total: 1 } },
    { $sort: { count: -1, status: 1 } },
  ]);
  res.json({ data });
}

module.exports = { salesByCategory, ordersByStatus };
