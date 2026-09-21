import fp from 'fastify-plugin';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

export default fp(async (app) => {
  app.decorate('firestore', db);
});

declare module 'fastify' {
  interface FastifyInstance {
    firestore: Firestore;
  }
}
