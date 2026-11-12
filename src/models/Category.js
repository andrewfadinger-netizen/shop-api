const { Schema, model } = require('mongoose');

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Название категории обязательно'],
      trim: true,
      minlength: [2, 'Название: минимум 2 символа'],
      maxlength: [50, 'Название: не длиннее 50 символов'],
    },
    slug: {
      type: String,
      required: [true, 'Поле slug обязательно'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug: латиница, цифры и дефисы (например, smartphones)'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Описание: не длиннее 500 символов'],
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
    id: false, // не дублировать _id виртуальным полем id
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Уникальность названия без учёта регистра: «Аудио» и «аудио» — одно и то же.
// collation strength: 2 — сравнение без учёта регистра для русского языка.
categorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'ru', strength: 2 }, name: 'name_unique_ci' }
);

// Виртуальный populate: количество товаров в категории считается по коллекции
// products (связь хранится в Product.category), в самой категории ничего не хранится.
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true,
});

module.exports = model('Category', categorySchema);
