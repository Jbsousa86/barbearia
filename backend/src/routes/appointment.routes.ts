import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Appointment, Barber, Service, User, Barbershop } from '../types/models.js';

const appointmentRoutes: FastifyPluginAsync = async (app) => {
  const appointmentsRef = app.firestore.collection('appointments');
  const barbershopsRef = app.firestore.collection('barbershops');
  const barbersRef = app.firestore.collection('barbers');
  const servicesRef = app.firestore.collection('services');
  const usersRef = app.firestore.collection('users');

  const populateAppointment = async (doc: any) => {
    const appt = doc.data() as Appointment;
    appt.id = doc.id;
    
    const [custDoc, barberDoc, serviceDoc, shopDoc] = await Promise.all([
      usersRef.doc(appt.customerId).get(),
      barbersRef.doc(appt.barberId).get(),
      servicesRef.doc(appt.serviceId).get(),
      barbershopsRef.doc(appt.barbershopId).get()
    ]);
    
    let customer = null;
    if (custDoc.exists) {
      const c = custDoc.data() as User;
      customer = { id: custDoc.id, name: c.name, phone: c.phone };
    }
    
    let barber = null;
    if (barberDoc.exists) {
      const b = barberDoc.data() as Barber;
      const uDoc = await usersRef.doc(b.userId).get();
      let bu = null;
      if (uDoc.exists) {
        const u = uDoc.data() as User;
        bu = { id: uDoc.id, name: u.name, phone: u.phone };
      }
      barber = { id: barberDoc.id, ...b, user: bu };
    }
    
    const service = serviceDoc.exists ? { id: serviceDoc.id, ...serviceDoc.data() } : null;
    const barbershop = shopDoc.exists ? { id: shopDoc.id, ...shopDoc.data() } : null;
    
    return { ...appt, customer, barber, service, barbershop };
  };

  app.get('/appointments', { preValidation: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.query as { userId?: string };
    
    let apptDocs: any[] = [];
    
    if (userId) {
      const ownedShopsSnap = await barbershopsRef.where('ownerId', '==', userId).get();
      const ownedShopIds = ownedShopsSnap.docs.map((d: any) => d.id);
      
      const barberSnap = await barbersRef.where('userId', '==', userId).get();
      const barberIds = barberSnap.docs.map((d: any) => d.id);
      
      const allAppointments = await appointmentsRef.orderBy('startsAt', 'asc').get();
      for (const d of allAppointments.docs) {
        const data = d.data() as Appointment;
        if (ownedShopIds.includes(data.barbershopId) || barberIds.includes(data.barberId)) {
          apptDocs.push(d);
        }
      }
    } else {
      const snap = await appointmentsRef.orderBy('startsAt', 'asc').get();
      apptDocs = snap.docs;
    }

    const appointments = await Promise.all(apptDocs.map(populateAppointment));
    return appointments;
  });

  app.get('/appointments/customer/:customerId', { preValidation: [app.authenticate] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const snap = await appointmentsRef.where('customerId', '==', customerId).orderBy('startsAt', 'desc').get();
    
    const appointments = await Promise.all(snap.docs.map(populateAppointment));
    return appointments;
  });

  app.post('/appointments', { preValidation: [app.authenticate] }, async (request, reply) => {
    const schema = z.object({
      name: z.string(),
      barberId: z.string(),
      serviceId: z.string(),
      time: z.string() // HH:mm
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(parsed.error);

    const { name, barberId, serviceId, time } = parsed.data;

    const [serviceDoc, barberDoc] = await Promise.all([
      servicesRef.doc(serviceId).get(),
      barbersRef.doc(barberId).get()
    ]);
    
    if (!serviceDoc.exists || !barberDoc.exists) {
      return reply.status(400).send({ message: 'Invalid service or barber' });
    }

    const service = serviceDoc.data() as Service;
    const barber = barberDoc.data() as Barber;

    if (request.user.role !== 'CUSTOMER') {
      return reply.status(403).send({ message: 'Apenas consumidores podem fazer agendamentos.' });
    }

    const customerId = request.user.uid;

    const today = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    const startsAt = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);

    const conflictSnap = await appointmentsRef
      .where('barberId', '==', barberId)
      .where('startsAt', '==', startsAt.toISOString())
      .limit(1)
      .get();

    if (!conflictSnap.empty) {
      return reply.status(409).send({ message: 'Este horário já está reservado com este barbeiro.' });
    }

    const newApptRef = appointmentsRef.doc();
    const apptData: Appointment = {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: 'SCHEDULED',
      customerId,
      barberId,
      serviceId,
      barbershopId: service.barbershopId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await newApptRef.set(apptData);

    return reply.status(201).send({ id: newApptRef.id, ...apptData });
  });
  
  app.patch('/appointments/:id/status', { preValidation: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    await appointmentsRef.doc(id).update({
      status,
      updatedAt: new Date().toISOString()
    });
    
    const updated = await appointmentsRef.doc(id).get();
    return { id, ...updated.data() };
  });
};

export default appointmentRoutes;
