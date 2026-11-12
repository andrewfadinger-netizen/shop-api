const ApiError = require('../utils/ApiError');
const { OBJECT_ID_RE } = require('../utils/query');

// Используется через router.param('id', validateId): некорректный id -> 400 ещё до запроса в БД.
module.exports = function validateId(req, res, next, value, name) {
  if (!OBJECT_ID_RE.test(value)) {
    return next(ApiError.badRequest(`Некорректный идентификатор «${name}»: ${value}`));
  }
  return next();
};
