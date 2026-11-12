const mongoose = require('mongoose');

mongoose.set('strictQuery', true); // поля, которых нет в схеме, в фильтрах игнорируются

async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const { host, port, name } = mongoose.connection;
  if (process.env.NODE_ENV !== 'test') {
    console.log(`MongoDB подключена: ${host}:${port}/${name}`);
  }
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
