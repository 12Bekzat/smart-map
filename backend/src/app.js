import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { ZodError } from 'zod';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { mapFeaturesRouter } from './routes/mapFeatures.js';
import { placesRouter } from './routes/places.js';
import { reportsRouter } from './routes/reports.js';
import { riskRouter } from './routes/risks.js';
import { routeRouter } from './routes/routes.js';
import { searchRouter } from './routes/search.js';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/places', placesRouter);
app.use('/api/risks', riskRouter);
app.use('/api/map', mapFeaturesRouter);
app.use('/api/search', searchRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/routes', routeRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: error.errors.map((item) => ({
        path: item.path.join('.'),
        message: item.message
      }))
    });
    return;
  }

  const status = error.status || 500;
  const message = status === 500 ? 'Internal server error' : error.message;
  if (status === 500) {
    console.error(error);
  }
  res.status(status).json({ error: message, details: error.details });
});
