const { Schema, model } = require('mongoose');

const isInteger = { validator: Number.isInteger, message: 'Значение должно быть целым числом' };

// Отзыв — встроенный документ: показывается на странице товара,
// принадлежит только этому товару. Автор — ссылка на users.
const reviewSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Автор отзыва (user) обязателен'],
    },
    rating: {
      type: Number,
      required: [true, 'Оценка обязательна'],
      min: [1, 'Оценка от 1 до 5'],
      max: [5, 'Оценка от 1 до 5'],
      validate: isInteger,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Отзыв: не длиннее 1000 символов'],
    },
  },
  { timestamps: true }
);

// Характеристики товара — паттерн «атрибут» (ключ/значение),
// у разных категорий разные характеристики, жёсткая схема не нужна.
const attributeSchema = new Schema(
  {
    key: { type: String, required: [true, 'Название характеристики обязательно'], trim: true, maxlength: 40 },
    value: { type: String, required: [true, 'Значение характеристики обязательно'], trim: true, maxlength: 100 },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Название товара обязательно'],
      trim: true,
      minlength: [2, 'Название: минимум 2 символа'],
      maxlength: [120, 'Название: не длиннее 120 символов'],
    },
    sku: {
      type: String,
      required: [true, 'Артикул (sku) обязателен'],
      trim: true,
      uppercase: true,
      unique: true,
      match: [/^[A-Z0-9-]{3,20}$/, 'Артикул: 3–20 символов, латиница, цифры, дефис'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Описание: не длиннее 2000 символов'],
    },
    price: {
      type: Number,
      required: [true, 'Цена обязательна'],
      min: [0, 'Цена не может быть отрицательной'],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Остаток не может быть отрицательным'],
      validate: isInteger,
    },
    // Ссылка (referencing) на категорию: категория — самостоятельная сущность,
    // одна на много товаров, её переименование не должно требовать правки товаров.
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Категория обязательна'],
      validate: {
        // MongoDB не проверяет внешние ключи — проверяем существование сами.
        validator: async (id) => Boolean(await model('Category').exists({ _id: id })),
        message: 'Категория с таким id не найдена',
      },
    },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      default: [],
    },
    attributes: { type: [attributeSchema], default: [] },
    reviews: {
      type: [reviewSchema],
      default: [],
      validate: { validator: (list) => list.length <= 200, message: 'Слишком много отзывов в документе' },
    },
    // Вычисляемое поле (computed pattern): пересчитывается при сохранении отзывов,
    // чтобы не считать среднее при каждом чтении и уметь сортировать по рейтингу.
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Полнотекстовый поиск по названию, тегам и описанию (с русской морфологией).
productSchema.index(
  { name: 'text', tags: 'text', description: 'text' },
  { weights: { name: 10, tags: 5, description: 1 }, default_language: 'russian', name: 'product_text' }
);
// Составной индекс под самый частый запрос каталога: «товары категории, по цене».
productSchema.index({ category: 1, price: 1 });
productSchema.index({ 'rating.avg': -1 });

productSchema.methods.recalcRating = function recalcRating() {
  const count = this.reviews.length;
  const sum = this.reviews.reduce((acc, r) => acc + r.rating, 0);
  this.rating = { avg: count ? Math.round((sum / count) * 10) / 10 : 0, count };
};

productSchema.pre('save', function updateRating() {
  if (this.isNew || this.isModified('reviews')) this.recalcRating();
});

module.exports = model('Product', productSchema);
