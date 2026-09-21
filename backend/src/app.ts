import cors from '@fastify/cors';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import authPlugin from './plugins/auth.js';
import firebasePlugin from './plugins/firebase.js';
import healthRoutes from './routes/health.routes.js';
import barbershopRoutes from './routes/barbershop.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import serviceRoutes from './routes/service.routes.js';
import authRoutes from './routes/auth.routes.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  const allowedOrigin = process.env.CORS_ORIGIN || true;
  app.register(cors, { origin: allowedOrigin });
  app.register(multipart);
  app.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/public/',
  });
  app.register(authPlugin);
  app.register(firebasePlugin);
  app.register(healthRoutes);
  app.register(barbershopRoutes, { prefix: '/api' });
  app.register(appointmentRoutes, { prefix: '/api' });
  app.register(serviceRoutes, { prefix: '/api' });
  app.register(authRoutes, { prefix: '/api' });

  return app;
}
