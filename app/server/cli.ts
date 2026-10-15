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
import { generateSynthetic, importSynthea } from './seed/synthetic.js';
import { listModules, MODULES, setModuleFlag } from './modules.js';
import { createOrganization, listOrganizations } from './services/orgs.js';
import { readiness } from './services/readiness.js';
import { closePdfBrowser } from './pdf/render.js';

const USAGE = `Eternal — narzędzia administracyjne

  npm run cli -- check [--live]                           gotowość do pracy: co działa naprawdę, co w trybie demo, co ustawić
                                                          (--live: test połączeń bez danych pacjentów)
  npm run cli -- create-org "<nazwa>" [--nip 1234567890]  nowa organizacja (klinika) — dane rozdzielone znacznikiem
  npm run cli -- orgs                                     lista organizacji
  npm run cli -- create-admin <email> "<Imię Nazwisko>" [--org <id>]
                                                          konto administratora kliniki (hasło z wejścia, MFA przy 1. logowaniu)
  npm run cli -- modules [--org <id>]                     moduły i ich stan (rejestr modułów)
  npm run cli -- set-module <id> on|off [--rollout 0-100] [--org <id>]
                                                          włączenie/wyłączenie modułu, wdrożenie stopniowe (A18.7)
  npm run cli -- synthetic [--count 20] [--seed 1] [--years 2] [--org <id>] [--pdf <katalog>] --purpose "<cel>"
                                                          dane syntetyczne (D5.3): fikcyjni pacjenci z danymi podłużnymi
  npm run cli -- import-synthea <katalog output/fhir> [--org <id>] [--limit N] --purpose "<cel>"
                                                          import paczek FHIR z Synthea (oznaczone jako fikcyjne)
  npm run cli -- seed-demo                                dane fikcyjne do prezentacji (DEMO_MODE=true)
  npm run cli -- import-rpl [plik.xml|URL]                import Rejestru Produktów Leczniczych
  npm run cli -- verify-audit                             weryfikacja łańcucha dziennika zdarzeń
  npm run cli -- backup <katalog>                         spójna kopia bazy (VACUUM INTO)
`;

/** Wartość opcji `--nazwa wartość` (albo undefined). */
function opt(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Argumenty pozycyjne (bez opcji `--x wartość`). */
function positional(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('--')) i += 1;
    else out.push(args[i]);
  }
  return out;
}

const cliActor = { display: 'cli' };

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === 'help') {
    console.log(USAGE);
    return;
  }
  await initCore();
  switch (cmd) {
    case 'check': {
      const r = await readiness({ live: args.includes('--live') });
      await closePdfBrowser();
      const icon = { ok: '✔', demo: 'DEMO', missing: '✘', warn: '!' } as const;
      let group = '';
      for (const i of r.items) {
        if (i.group !== group) console.log(`\n== ${(group = i.group)}`);
        console.log(`${icon[i.state].padEnd(4)} ${i.name}: ${i.detail}`);
        if (i.live) console.log(`     test: ${i.live.ok ? 'OK' : 'BŁĄD'} — ${i.live.detail} (${i.live.ms} ms)`);
        if (i.howTo) console.log(`     → ${i.howTo}`);
      }
      console.log(`\nGotowe: ${r.summary.ok} · tryb demo: ${r.summary.demo} · brakuje: ${r.summary.missing} · do decyzji/uwagi: ${r.summary.warn}`);
      if (r.summary.missing > 0 && !args.includes('--no-fail')) process.exitCode = 2;
      break;
    }
    case 'create-org': {
      const [name] = positional(args);
      if (!name) throw new Error('Użycie: create-org "<nazwa>" [--nip 1234567890]');
      const org = await createOrganization(cliActor, { name, nip: opt(args, 'nip') });
      console.log(`Utworzono organizację ${org.name} (id: ${org.id}). Administratora dodasz: create-admin <email> "<Imię Nazwisko>" --org ${org.id}`);
      break;
    }
    case 'orgs': {
      for (const o of await listOrganizations()) console.log(`${o.id}  ${o.name}`);
      break;
    }
    case 'modules': {
      const orgId = opt(args, 'org');
      for (const m of listModules(orgId)) console.log(`${m.code.padEnd(4)} ${m.id.padEnd(16)} ${m.enabled ? 'wł. ' : 'wył.'} ${String(m.rollout).padStart(3)}%  ${m.scope === 'global' ? 'operator' : 'klinika '}  ${m.name}`);
      break;
    }
    case 'set-module': {
      const [id, state] = positional(args);
      if (!id || !['on', 'off'].includes(state ?? '')) throw new Error('Użycie: set-module <id> on|off [--rollout 0-100] [--org <id>]');
      if (!MODULES.some((m) => m.id === id)) throw new Error(`Nieznany moduł: ${id}. Dostępne: ${MODULES.map((m) => m.id).join(', ')}`);
      const rollout = opt(args, 'rollout');
      setModuleFlag(cliActor, id, { enabled: state === 'on', ...(rollout !== undefined ? { rollout: Math.max(0, Math.min(100, Number(rollout))) } : {}) }, opt(args, 'org'));
      console.log(`Moduł ${id}: ${state === 'on' ? 'włączony' : 'wyłączony'}${rollout !== undefined ? `, wdrożenie ${rollout}%` : ''}.`);
      break;
    }
    case 'synthetic': {
      const purpose = opt(args, 'purpose');
      if (!purpose) throw new Error('Podaj cel użycia danych syntetycznych: --purpose "<cel>" (zapis w rejestrze użyć)');
      const r = await generateSynthetic(cliActor, {
        count: Number(opt(args, 'count') ?? 20),
        seed: Number(opt(args, 'seed') ?? 1),
        years: Number(opt(args, 'years') ?? 2),
        orgId: opt(args, 'org'),
        pdfDir: opt(args, 'pdf'),
        purpose,
      });
      console.log(`Dane syntetyczne: ${r.patients} pacjentów, ${r.reports} wyników, ${r.measurements} pomiarów${r.pdfs.length ? `, ${r.pdfs.length} plików PDF + oczekiwane.json` : ''}. Wszystkie oznaczone jako fikcyjne.`);
      break;
    }
    case 'import-synthea': {
      const [dir] = positional(args);
      const purpose = opt(args, 'purpose');
      if (!dir || !purpose) throw new Error('Użycie: import-synthea <katalog output/fhir> --purpose "<cel>" [--org <id>] [--limit N]');
      const limit = opt(args, 'limit');
      const r = await importSynthea(cliActor, path.resolve(dir), { orgId: opt(args, 'org'), purpose, limit: limit ? Number(limit) : undefined });
      console.log(`Zaimportowano z Synthea: ${r.patients} pacjentów, ${r.observations} wyników laboratoryjnych (oznaczone jako fikcyjne).`);
      break;
    }
    case 'create-admin': {
      const [email, name] = positional(args);
      if (!email || !name) throw new Error('Użycie: create-admin <email> "<Imię Nazwisko>"');
      if (findUserByEmail(email)) throw new Error('Konto z tym adresem już istnieje');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const password = process.env.ADMIN_PASSWORD ?? (await rl.question('Hasło (min. 12 znaków): '));
      rl.close();
      const problems = passwordProblems(password, Math.max(12, config.security.minPasswordLength), [email.split('@')[0]]);
      if (problems.length) throw new Error(`Hasło odrzucone: ${problems.join(', ')}`);
      createUser({ email, passwordHash: await hashPassword(password), roles: ['admin', 'reception'], displayName: name, emailVerified: true, orgId: opt(args, 'org') });
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
