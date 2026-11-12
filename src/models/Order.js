const { Schema, model } = require('mongoose');
const { shippingAddressSchema } = require('./schemas/address');

const STATUSES = ['new', 'paid', 'shipped', 'delivered', 'cancelled'];

// Допустимые переходы статуса заказа (конечный автомат).
const TRANSITIONS = {
  new: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// Позиция заказа — встроенный документ + ссылка на товар.
// name/sku/price КОПИРУЮТСЯ из товара (snapshot pattern): цена в заказе
// должна остаться той, по которой купили, даже если товар потом подорожает.
const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String },
    price: { type: Number, required: true, min: 0 },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Количество не меньше 1'],
      validate: { validator: Number.isInteger, message: 'Количество — целое число' },
    },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Покупатель (user) обязателен'],
      validate: {
        validator: async (id) => Boolean(await model('User').exists({ _id: id })),
        message: 'Пользователь с таким id не найден',
      },
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (list) => list.length > 0,
        message: 'Заказ должен содержать хотя бы один товар',
      },
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, 'Адрес доставки обязателен'],
    },
    status: {
      type: String,
      enum: { values: STATUSES, message: `Статус: ${STATUSES.join(', ')}` },
      default: 'new',
    },
    total: { type: Number, min: 0, default: 0 },
    comment: { type: String, trim: true, maxlength: [500, 'Комментарий: не длиннее 500 символов'] },
  },
  {
    timestamps: true,
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// История заказов пользователя (новые сверху) и фильтр по статусу.
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Сумма заказа считается на сервере, клиенту не доверяем.
orderSchema.pre('validate', function calcTotal() {
  const sum = (this.items || []).reduce((acc, i) => acc + i.price * i.quantity, 0);
  this.total = Math.round(sum * 100) / 100;
});

orderSchema.statics.STATUSES = STATUSES;
orderSchema.statics.TRANSITIONS = TRANSITIONS;

module.exports = model('Order', orderSchema);
