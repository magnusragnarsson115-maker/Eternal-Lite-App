import path from 'node:path';
import readline from 'node:readline/promises';
import { verifyAuditChain } from './audit.js';
import { hashPassword, passwordProblems } from './auth/passwords.js';
import { createUser, findUserByEmail } from './auth/users.js';
import { initCore } from './bootstrap.js';
import { config } from './config.js';
import { closeDatabase, getDb } from './db.js';
import { importRpl, RPL_EXPORT_URL } from './integrations/rpl.js';
import { DEMO_PASSWORD, DEMO_TOTP_SECRET, seedDemo } from './seed/demo.js';

const USAGE = `Eternal — narzędzia administracyjne

  npm run cli -- create-admin <email> "<Imię Nazwisko>"   konto administratora (hasło z wejścia, MFA przy 1. logowaniu)
  npm run cli -- seed-demo                                dane fikcyjne do prezentacji (DEMO_MODE=true)
  npm run cli -- import-rpl [plik.xml|URL]                import Rejestru Produktów Leczniczych
  npm run cli -- verify-audit                             weryfikacja łańcucha dziennika zdarzeń
  npm run cli -- backup <katalog>                         spójna kopia bazy (VACUUM INTO)
`;

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === 'help') {
    console.log(USAGE);
    return;
  }
  await initCore();
  switch (cmd) {
    case 'create-admin': {
      const [email, name] = args;
      if (!email || !name) throw new Error('Użycie: create-admin <email> "<Imię Nazwisko>"');
      if (findUserByEmail(email)) throw new Error('Konto z tym adresem już istnieje');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const password = process.env.ADMIN_PASSWORD ?? (await rl.question('Hasło (min. 12 znaków): '));
      rl.close();
      const problems = passwordProblems(password, Math.max(12, config.security.minPasswordLength), [email.split('@')[0]]);
      if (problems.length) throw new Error(`Hasło odrzucone: ${problems.join(', ')}`);
      createUser({ email, passwordHash: await hashPassword(password), roles: ['admin', 'reception'], displayName: name, emailVerified: true });
      console.log(`Utworzono administratora ${email}. Przy pierwszym logowaniu wymagane będzie skonfigurowanie MFA (TOTP).`);
      break;
    }
    case 'seed-demo':
      await seedDemo();
      console.log(`\nKonta demonstracyjne (hasło: ${DEMO_PASSWORD}):
  pacjent@eternal.local          — pacjentka (Anna Kowalska, fikcyjna)
  maria@eternal.local            — pacjentka z niepotwierdzoną tożsamością
  recepcja@eternal.local         — rejestracja            (MFA)
  anna.nowicka@eternal.local     — lekarz                 (MFA)
  piotr.zielinski@eternal.local  — lekarz                 (MFA)
  admin@eternal.local            — administrator          (MFA)
Sekret TOTP kont personelu w trybie demo: ${DEMO_TOTP_SECRET} (dodaj w aplikacji uwierzytelniającej).`);
      break;
    case 'import-rpl': {
      const source = args[0] ?? RPL_EXPORT_URL;
      console.log(`Import RPL z: ${source}`);
      const r = await importRpl(source);
      console.log(`Zaimportowano ${r.imported} produktów leczniczych.`);
      break;
    }
    case 'verify-audit': {
      const r = verifyAuditChain();
      console.log(r.ok ? `Łańcuch poprawny (${r.count} wpisów).` : `NARUSZENIE łańcucha przy wpisie #${r.brokenAt}.`);
      if (!r.ok) process.exitCode = 2;
      break;
    }
    case 'backup': {
      const dir = path.resolve(args[0] ?? path.join(config.dataDir, 'backups'));
      const file = path.join(dir, `eternal-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
      (await import('node:fs')).mkdirSync(dir, { recursive: true });
      getDb().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
      console.log(`Kopia zapisana: ${file} (zawiera dane osobowe — szyfruj przy przechowywaniu).`);
      break;
    }
    default:
      console.log(USAGE);
      process.exitCode = 1;
  }
  closeDatabase();
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
