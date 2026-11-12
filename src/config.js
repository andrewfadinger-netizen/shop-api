const path = require('path');

// Переменные окружения из .env (встроенная функция Node.js >= 20.12, без dotenv).
try {
  process.loadEnvFile(path.resolve(__dirname, '..', '.env'));
} catch {
  // .env может отсутствовать — тогда берутся значения по умолчанию
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shop_db',
  nodeEnv: process.env.NODE_ENV || 'development',
};
