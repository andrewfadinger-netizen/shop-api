const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const api = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get('/', (req, res) => {
    res.json({
      name: 'Shop API — интернет-магазин электроники',
      endpoints: ['/api/health', '/api/categories', '/api/products', '/api/users', '/api/orders', '/api/stats'],
    });
  });

  app.get('/api/health', (req, res) => {
    const state = DB_STATES[mongoose.connection.readyState] || 'unknown';
    res.status(state === 'connected' ? 200 : 503).json({
      status: state === 'connected' ? 'ok' : 'degraded',
      db: state,
      database: mongoose.connection.name,
    });
  });

  app.use('/api', api);

  app.use(notFound);
  app.use(errorHandler); // Express 5 сам передаёт сюда ошибки из async-обработчиков
  return app;
}

module.exports = createApp;
