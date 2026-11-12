const { Schema, model } = require('mongoose');
const { addressSchema } = require('./schemas/address');

const ROLES = ['customer', 'admin'];

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Имя обязательно'],
      trim: true,
      minlength: [2, 'Имя: минимум 2 символа'],
      maxlength: [60, 'Имя: не длиннее 60 символов'],
    },
    email: {
      type: String,
      required: [true, 'Email обязателен'],
      trim: true,
      lowercase: true,
      unique: true, // создаёт уникальный индекс email_1
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Некорректный email'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+7\d{10}$/, 'Телефон в формате +7XXXXXXXXXX'],
    },
    role: {
      type: String,
      enum: { values: ROLES, message: 'Роль должна быть customer или admin' },
      default: 'customer',
    },
    // Встроенные документы: адреса читаются всегда вместе с пользователем,
    // их мало (ограничение — 5) и без пользователя они не имеют смысла.
    addresses: {
      type: [addressSchema],
      validate: {
        validator: (list) => list.length <= 5,
        message: 'Не более 5 адресов у одного пользователя',
      },
    },
  },
  {
    timestamps: true,
    id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.index({ role: 1 });
userSchema.index({ 'addresses.city': 1 }); // индекс по полю встроенного массива (multikey)

// Ровно один адрес по умолчанию: если не отмечен ни один — первый,
// если отмечено несколько — остаётся первый отмеченный.
userSchema.pre('validate', function normalizeDefaultAddress() {
  if (!this.addresses || this.addresses.length === 0) return;
  let found = false;
  for (const addr of this.addresses) {
    if (addr.isDefault && !found) found = true;
    else addr.isDefault = false;
  }
  if (!found) this.addresses[0].isDefault = true;
});

// Виртуальная связь «пользователь → его заказы» (ссылка хранится в Order.user).
userSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'user',
});

userSchema.statics.ROLES = ROLES;

module.exports = model('User', userSchema);
