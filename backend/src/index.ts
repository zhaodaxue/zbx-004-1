import express from 'express';
import cors from 'cors';
import routes from './routes';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({
    name: 'Darkroom Chemical Management API',
    version: '1.0.0',
    endpoints: {
      dashboard: '/api/dashboard',
      formulas: '/api/formulas',
      stockBatches: '/api/stock-batches',
      dilutions: '/api/dilutions',
      tasks: '/api/tasks',
      trace: '/api/trace/:taskId',
      health: '/api/health',
    },
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Darkroom Backend running on http://0.0.0.0:${PORT}`);
  console.log(`   CORS origin: ${CORS_ORIGIN}`);
});

export default app;
