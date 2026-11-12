const { Router } = require('express');
const validateId = require('../middleware/validateId');
const categories = require('../controllers/categoryController');
const products = require('../controllers/productController');
const users = require('../controllers/userController');
const orders = require('../controllers/orderController');
const stats = require('../controllers/statsController');

// Стандартный набор CRUD-маршрутов для сущности
function crudRouter(controller) {
  const router = Router();
  router.param('id', validateId);
  router.route('/').get(controller.list).post(controller.create);
  router.route('/:id').get(controller.get).patch(controller.update).delete(controller.remove);
  return router;
}

const productRouter = crudRouter(products);
productRouter.param('reviewId', validateId);
productRouter.route('/:id/reviews').get(products.listReviews).post(products.addReview);
productRouter
  .route('/:id/reviews/:reviewId')
  .patch(products.updateReview)
  .delete(products.deleteReview);

const statsRouter = Router();
statsRouter.get('/sales-by-category', stats.salesByCategory);
statsRouter.get('/orders-by-status', stats.ordersByStatus);

const api = Router();
api.use('/categories', crudRouter(categories));
api.use('/products', productRouter);
api.use('/users', crudRouter(users));
api.use('/orders', crudRouter(orders));
api.use('/stats', statsRouter);

module.exports = api;
