import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Service } from '../types/models.js';

const serviceRoutes: FastifyPluginAsync = async (app) => {
  const servicesRef = app.firestore.collection('services');
  const barbersRef = app.firestore.collection('barbers');

  app.post('/services', { preValidation: [app.authenticate] }, async (request, reply) => {
    const schema = z.object({
      name: z.string(),
      durationMin: z.number(),
      priceCents: z.number(),
      barbershopId: z.string(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const newServiceRef = servicesRef.doc();
    const serviceData: Service = {
      ...parsed.data,
      createdAt: new Date().toISOString()
    };
    
    await newServiceRef.set(serviceData);

    return reply.status(201).send({ id: newServiceRef.id, ...serviceData });
  });

  app.delete('/services/:id', { preValidation: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await servicesRef.doc(id).delete();
    return reply.status(204).send();
  });

  app.patch('/barbers/:id/schedule', { preValidation: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      workStart: z.string(),
      workEnd: z.string(),
      breakStart: z.string().optional(),
      breakEnd: z.string().optional()
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const { workStart, workEnd, breakStart, breakEnd } = parsed.data;

    await barbersRef.doc(id).update({
      workStart, workEnd, breakStart: breakStart || null, breakEnd: breakEnd || null
    });

    const updated = await barbersRef.doc(id).get();

    return { id, ...updated.data() };
  });
};

export default serviceRoutes;
