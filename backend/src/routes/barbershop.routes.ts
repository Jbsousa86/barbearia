import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';
import { pipeline } from 'stream';
import { Barbershop, Barber, User, Service } from '../types/models.js';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const pump = util.promisify(pipeline);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const barbershopRoutes: FastifyPluginAsync = async (app) => {
  const barbershopsRef = app.firestore.collection('barbershops');
  const barbersRef = app.firestore.collection('barbers');
  const usersRef = app.firestore.collection('users');
  const servicesRef = app.firestore.collection('services');

  // Helper function to populate barbershop with services and barbers
  const populateBarbershop = async (shopDoc: any) => {
    const shop = shopDoc.data() as Barbershop;
    shop.id = shopDoc.id;

    const [servicesSnap, barbersSnap] = await Promise.all([
      servicesRef.where('barbershopId', '==', shop.id).get(),
      barbersRef.where('barbershopId', '==', shop.id).get()
    ]);

    const services = servicesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    
    const barbers = await Promise.all(barbersSnap.docs.map(async (bDoc: any) => {
      const barberData = bDoc.data() as Barber;
      const userDoc = await usersRef.doc(barberData.userId).get();
      let userData = null;
      if (userDoc.exists) {
        const u = userDoc.data() as User;
        userData = { id: userDoc.id, name: u.name, email: u.email, isActive: u.isActive };
      }
      return { id: bDoc.id, ...barberData, user: userData };
    }));

    return { ...shop, services, barbers };
  };

  app.get('/barbershops', async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    
    let shopDocs: any[] = [];

    if (userId) {
      const [ownerSnap, barberSnap] = await Promise.all([
        barbershopsRef.where('ownerId', '==', userId).get(),
        barbersRef.where('userId', '==', userId).get()
      ]);
      
      const ownerDocs = ownerSnap.docs;
      
      let barberShopDocs: any[] = [];
      if (!barberSnap.empty) {
        const barberData = barberSnap.docs[0].data() as Barber;
        const shopDoc = await barbershopsRef.doc(barberData.barbershopId).get();
        if (shopDoc.exists) barberShopDocs.push(shopDoc);
      }
      
      const allDocs = [...ownerDocs, ...barberShopDocs];
      // Deduplicate by ID
      const uniqueDocsMap = new Map();
      for (const d of allDocs) {
        uniqueDocsMap.set(d.id, d);
      }
      shopDocs = Array.from(uniqueDocsMap.values());
    } else {
      const snap = await barbershopsRef.get();
      shopDocs = snap.docs;
    }

    const shops = await Promise.all(shopDocs.map(populateBarbershop));
    return shops;
  });

  app.get('/barbershops/slug/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const snap = await barbershopsRef.where('slug', '==', slug).limit(1).get();
    
    if (snap.empty) return reply.status(404).send({ message: 'Barbearia não encontrada' });
    
    const shop = await populateBarbershop(snap.docs[0]);
    return shop;
  });

  app.post('/barbershops', { preValidation: [app.authenticate] }, async (request, reply) => {
    const schema = z.object({
      name: z.string(),
      address: z.string(),
      slug: z.string(),
      ownerId: z.string()
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);
    
    const newShopRef = barbershopsRef.doc();
    const shopData: Barbershop = {
      ...parsed.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await newShopRef.set(shopData);
    
    return reply.status(201).send({ id: newShopRef.id, ...shopData });
  });

  app.post('/barbershops/:id/barbers', { preValidation: [app.authenticate] }, async (request, reply) => {
    // Only the owner of the barbershop should be able to create a barber (simplified check)
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
      password: z.string().min(6),
      phone: z.string().optional()
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    // Create user in Firebase Auth
    let firebaseUser;
    try {
      firebaseUser = await getAuth().createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.name,
      });
      // Set custom claim for role
      await getAuth().setCustomUserClaims(firebaseUser.uid, { role: 'BARBER' });
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        return reply.status(400).send({ message: 'E-mail já está em uso' });
      }
      app.log.error(error);
      return reply.status(500).send({ message: error.message || 'Erro ao criar usuário no Firebase' });
    }

    const newUserRef = usersRef.doc(firebaseUser.uid);
    const newUserData: User = {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: 'firebase',
      phone: parsed.data.phone || null,
      role: 'BARBER',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const newBarberRef = barbersRef.doc();
    const newBarberData: Barber = {
      userId: firebaseUser.uid,
      barbershopId: id,
      workStart: '09:00',
      workEnd: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      createdAt: new Date().toISOString()
    };

    const batch = app.firestore.batch();
    batch.set(newUserRef, newUserData);
    batch.set(newBarberRef, newBarberData);
    await batch.commit();

    return reply.status(201).send({ id: firebaseUser.uid, ...newUserData, barber: { id: newBarberRef.id, ...newBarberData } });
  });

  app.patch('/barbershops/:id', { preValidation: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().optional(),
      address: z.string().optional(),
      imageUrl: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    await barbershopsRef.doc(id).update({
      ...parsed.data,
      updatedAt: new Date().toISOString()
    });

    const updatedDoc = await barbershopsRef.doc(id).get();
    return reply.status(200).send({ id, ...updatedDoc.data() });
  });

  app.post('/barbershops/:id/upload', { preValidation: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await request.file();
    if (!data) return reply.status(400).send({ message: 'Nenhum arquivo enviado.' });

    const ext = path.extname(data.filename) || '.png';
    const filename = `uploads/barbershops/${id}-${Date.now()}${ext}`;
    
    const bucket = getStorage().bucket('barbearia-3e0ef.firebasestorage.app');
    const file = bucket.file(filename);
    
    await pump(data.file, file.createWriteStream({
      metadata: { contentType: data.mimetype }
    }));

    const encodedFilename = encodeURIComponent(filename);
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/barbearia-3e0ef.firebasestorage.app/o/${encodedFilename}?alt=media`;
    await barbershopsRef.doc(id).update({
      imageUrl,
      updatedAt: new Date().toISOString()
    });

    const updatedDoc = await barbershopsRef.doc(id).get();
    return reply.status(200).send({ id, ...updatedDoc.data() });
  });
};

export default barbershopRoutes;
