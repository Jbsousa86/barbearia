# BarberSaaS API

API REST em Node.js, TypeScript, Fastify e Prisma para gerenciamento de barbearias e agendamentos.

## Requisitos

- Node.js 20+
- PostgreSQL 15+

## Desenvolvimento

```bash
copy .env.example .env
npm install
npm run prisma:generate
npm run dev
```

A API inicia em `http://localhost:3333`. O endpoint `GET /health` confirma que o servidor está disponível.

Para criar a primeira migration após configurar o PostgreSQL:

```bash
npm run prisma:migrate -- --name init
```
