import { buildApp } from './app.js';
import { initCore, productionWarnings, startJobs } from './bootstrap.js';
import { config } from './config.js';
import { closeDatabase } from './db.js';

async function main(): Promise<void> {
  await initCore();
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
