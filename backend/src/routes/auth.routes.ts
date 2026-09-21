import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { User, Barber, Barbershop } from '../types/models.js';
import { getAuth } from 'firebase-admin/auth';

const authRoutes: FastifyPluginAsync = async (app) => {
  const usersRef = app.firestore.collection('users');
  const barbersRef = app.firestore.collection('barbers');
  const barbershopsRef = app.firestore.collection('barbershops');

  // /auth/sync is called after a user logs in via Firebase on the frontend
  // It ensures the Firestore User document exists and returns the user profile
  app.post('/sync', { preValidation: [app.authenticate] }, async (request, reply) => {
    const { uid, email, role } = request.user;
    
    // Optional data from frontend (e.g. name, phone when first signing up)
    const schema = z.object({
      name: z.string().optional(),
      phone: z.string().optional()
    });
    const parsed = schema.safeParse(request.body);
    const bodyData = parsed.success ? parsed.data : {};

    const userDoc = await usersRef.doc(uid).get();
    
    let userData: User;

    if (!userDoc.exists) {
      // User doesn't exist in Firestore, create it
      // By default, assume they are CUSTOMER unless the token has a different role claim
      // Or if we know the email, we can pull name/phone from bodyData
      userData = {
        name: bodyData.name || email?.split('@')[0] || 'Novo Usuário',
        email: email || '',
        passwordHash: 'firebase', // no longer used
        phone: bodyData.phone || null,
        role: role,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await usersRef.doc(uid).set(userData);
    } else {
      userData = userDoc.data() as User;
      // Optionally update name/phone if provided
      const updates: any = {};
      if (bodyData.name && bodyData.name !== userData.name) updates.name = bodyData.name;
      if (bodyData.phone && bodyData.phone !== userData.phone) updates.phone = bodyData.phone;
      
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString();
        await usersRef.doc(uid).update(updates);
        Object.assign(userData, updates);
      }
    }

    // Fetch Barber/Shop data if applicable
    let shop = null;
    if (userData.role === 'BARBER') {
      const barberSnap = await barbersRef.where('userId', '==', uid).limit(1).get();
      if (!barberSnap.empty) {
        const barber = barberSnap.docs[0].data() as Barber;
        const barbershopDoc = await barbershopsRef.doc(barber.barbershopId).get();
        if (barbershopDoc.exists) {
          const barbershop = barbershopDoc.data() as Barbershop;
          shop = { id: barbershopDoc.id, name: barbershop.name, slug: barbershop.slug };
        }
      }
    }

    return reply.status(200).send({
      user: { id: uid, name: userData.name, email: userData.email, role: userData.role },
      shop
    });
  });

  app.patch('/users/:id/toggle-status', { preValidation: [app.authenticate] }, async (request, reply) => {
    // Ideally check if req.user has ADMIN privileges
    const { id } = request.params as { id: string };
    const userDoc = await usersRef.doc(id).get();
    if (!userDoc.exists) return reply.status(404).send({ message: 'Usuário não encontrado' });
    
    const user = userDoc.data() as User;
    const newStatus = !user.isActive;
    
    await usersRef.doc(id).update({
      isActive: newStatus,
      updatedAt: new Date().toISOString()
    });
    
    return { ...user, id, isActive: newStatus };
  });

  app.patch('/users/:id', { preValidation: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Only allow users to update their own profile
    if (request.user.uid !== id) {
      return reply.status(403).send({ message: 'Forbidden' });
    }

    const schema = z.object({
      name: z.string().optional(),
      phone: z.string().optional()
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const userDoc = await usersRef.doc(id).get();
    if (!userDoc.exists) return reply.status(404).send({ message: 'Usuário não encontrado' });
    const user = userDoc.data() as User;

    const dataToUpdate: any = { updatedAt: new Date().toISOString() };
    if (parsed.data.name) dataToUpdate.name = parsed.data.name;
    if (parsed.data.phone) dataToUpdate.phone = parsed.data.phone;

    await usersRef.doc(id).update(dataToUpdate);
    
    return reply.status(200).send({
      id,
      name: dataToUpdate.name || user.name,
      email: user.email,
      phone: dataToUpdate.phone !== undefined ? dataToUpdate.phone : user.phone,
      role: user.role
    });
  });
};

export default authRoutes;
