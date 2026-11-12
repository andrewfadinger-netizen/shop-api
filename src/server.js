const config = require('./config');
const { connectDB, disconnectDB } = require('./db');
const createApp = require('./app');

async function main() {
  await connectDB(config.mongoUri);
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Сервер запущен: http://localhost:${config.port}`);
  });

  // Корректное завершение: закрыть HTTP-сервер и соединение с БД
  const shutdown = async (signal) => {
    console.log(`\n${signal}: останавливаю сервер...`);
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Не удалось запустить сервер:', err.message);
  process.exit(1);
});
