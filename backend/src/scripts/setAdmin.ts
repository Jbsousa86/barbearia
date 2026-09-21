import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

// Inicializa o Firebase (usando a credencial do .env que configuramos)
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Erro: GOOGLE_APPLICATION_CREDENTIALS não definido no .env');
  process.exit(1);
}

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const email = process.argv[2];

if (!email) {
  console.error('Por favor, informe o e-mail do administrador. Exemplo: npm run set-admin admin@email.com');
  process.exit(1);
}

async function setAdmin() {
  try {
    const user = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(user.uid, { role: 'SAAS_ADMIN' });
    console.log(`✅ Sucesso! O usuário ${email} agora é um SAAS_ADMIN.`);
    console.log(`Na próxima vez que ele logar no frontend, terá acesso total ao painel.`);
    process.exit(0);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ Erro: Nenhum usuário encontrado no Firebase com o e-mail: ${email}`);
      console.error(`Dica: Crie o usuário primeiro no painel do Firebase (Authentication) e depois rode este comando.`);
    } else {
      console.error('❌ Erro inesperado:', error);
    }
    process.exit(1);
  }
}

setAdmin();
