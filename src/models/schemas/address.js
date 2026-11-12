const { Schema } = require('mongoose');

// Общие поля адреса. Функция возвращает новый объект, чтобы две схемы
// не делили одни и те же объекты-описания полей.
const addressFields = () => ({
  city: {
    type: String,
    required: [true, 'Город обязателен'],
    trim: true,
    maxlength: [60, 'Город: не длиннее 60 символов'],
  },
  street: {
    type: String,
    required: [true, 'Адрес (улица, дом) обязателен'],
    trim: true,
    maxlength: [120, 'Адрес: не длиннее 120 символов'],
  },
  zip: {
    type: String,
    trim: true,
    maxlength: [10, 'Индекс: не длиннее 10 символов'],
  },
});

// Адрес пользователя — ВСТРОЕННЫЙ документ (embedding) в коллекции users.
// У каждого адреса свой _id, чтобы его можно было найти/изменить.
const addressSchema = new Schema({
  label: {
    type: String,
    trim: true,
    maxlength: [30, 'Метка адреса: не длиннее 30 символов'],
    default: 'Дом',
  },
  ...addressFields(),
  isDefault: { type: Boolean, default: false },
});

// Адрес доставки в заказе — КОПИЯ (snapshot) на момент оформления.
// Если пользователь потом поменяет адрес в профиле, заказ не изменится.
const shippingAddressSchema = new Schema(addressFields(), { _id: false });

module.exports = { addressSchema, shippingAddressSchema };
