import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const appointments = await prisma.appointment.findMany({
    include: {
      barber: {
        include: { user: true }
      }
    }
  });

  console.log('Appointments in DB:');
  for (const a of appointments) {
    console.log(`- ID: ${a.id}`);
    console.log(`  Barber: ${a.barber.user.name} (${a.barberId})`);
    console.log(`  StartsAt: ${a.startsAt.toISOString()} (Local: ${a.startsAt.toLocaleString()})`);
  }
}

main().finally(() => prisma.$disconnect());
