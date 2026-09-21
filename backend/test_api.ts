import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const service = await prisma.service.findFirst();
  const barber = await prisma.barber.findFirst();

  if (!service || !barber) {
    console.log("No service or barber found");
    return;
  }

  console.log(`Using Service: ${service.id}, Barber: ${barber.id}`);

  const time = "10:30";
  const body = {
    name: 'Test Customer',
    time: time,
    serviceId: service.id,
    barberId: barber.id
  };

  const res = await fetch('http://localhost:3333/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const data = await res.json();
  console.log({ status: res.status, data });
}

test().finally(() => prisma.$disconnect());
