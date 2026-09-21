export interface User {
  id?: string;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Barbershop {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  address: string;
  phone?: string | null;
  imageUrl?: string | null;
  ownerId: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Barber {
  id?: string;
  userId: string;
  barbershopId: string;
  workStart: string;
  workEnd: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  createdAt?: string | Date;
}

export interface Service {
  id?: string;
  name: string;
  durationMin: number;
  priceCents: number;
  barbershopId: string;
  createdAt?: string | Date;
}

export interface Appointment {
  id?: string;
  startsAt: string | Date;
  endsAt: string | Date;
  status: string;
  customerId: string;
  barberId: string;
  serviceId: string;
  barbershopId: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
