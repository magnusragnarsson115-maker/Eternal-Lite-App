import { buildApp } from './app.js';
import { initCore, productionWarnings, startJobs } from './bootstrap.js';
import { config } from './config.js';
import { closeDatabase } from './db.js';

async function main(): Promise<void> {
  await initCore();
  // instancja pokazowa (np. dla inwestorów): dane fikcyjne tworzone przy pierwszym starcie, gdy baza jest pusta
  if (config.demoMode && process.env.DEMO_SEED_ON_START === 'true') {
    const { seedDemo } = await import('./seed/demo.js');
    await seedDemo((m) => console.log(m));
  }
  if (config.demoMode) {
    (await import('./integrations/registries.js')).ensureDemoRegistries();
    await (await import('./seed/round4.js')).seedRound4Demo((m) => console.log(m));
  }
  const app = await buildApp({ logger: true });
  for (const w of productionWarnings()) app.log.warn(w);
  const stopJobs = startJobs((msg, err) => app.log.error({ err }, msg));
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`Eternal działa: ${config.publicUrl} (FHIR: ${config.fhir.backend}, demo: ${config.demoMode})`);

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} — zamykanie`);
    stopJobs();
    await app.close();
    closeDatabase();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
