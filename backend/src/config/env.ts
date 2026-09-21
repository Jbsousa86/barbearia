import { z } from 'zod';

const envSchema = z.object({
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default('0.0.0.0'),
});

export const env = envSchema.parse({
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  PORT: process.env.PORT,
  HOST: process.env.HOST,
});
