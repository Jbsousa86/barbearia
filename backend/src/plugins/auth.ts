import fp from 'fastify-plugin';
import { getAuth } from 'firebase-admin/auth';
import { FastifyRequest, FastifyReply } from 'fastify';

export default fp(async (app) => {
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ message: 'Unauthorized: No token provided' });
      }

      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await getAuth().verifyIdToken(token);
      
      request.user = {
        uid: decodedToken.uid,
        role: (decodedToken.role as string) || 'CUSTOMER',
        email: decodedToken.email
      };
    } catch (err) {
      app.log.error(err);
      return reply.status(401).send({ message: 'Unauthorized: Invalid token' });
    }
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: {
      uid: string;
      role: string;
      email?: string;
    };
  }
}
