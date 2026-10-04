import type { FastifyInstance } from 'fastify';
import { requireUser } from '../auth/sessions.js';
import { isStaff } from '../auth/users.js';
import { bus, type DomainEvent } from '../events.js';

/**
 * Server-Sent Events: zmiany po jednej stronie (pacjent/placówka) są natychmiast widoczne po drugiej.
 * Pacjent dostaje wyłącznie zdarzenia dotyczące siebie; zdarzenia nie zawierają danych medycznych.
 */
export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/events', async (req, reply) => {
    const auth = requireUser(req);
    const staff = isStaff(auth.user);
    const patientRef = auth.user.fhir_ref;
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: 3000\n\n`);

    const relevant = (e: DomainEvent): boolean => {
      if (e.userId) return e.userId === auth.user.id;
      if (staff) return e.staff !== false;
      return !!patientRef && e.patientRef === patientRef;
    };
    const unsubscribe = bus.subscribe((e) => {
      if (!relevant(e)) return;
      // dla pacjenta nie przekazujemy referencji zasobów innych niż jego własne
      const payload = staff ? e : { type: e.type, resourceRef: e.resourceRef, at: e.at };
      res.write(`event: change\ndata: ${JSON.stringify(payload)}\n\n`);
    });
    const ping = setInterval(() => res.write(`: ping\n\n`), 25_000);
    // sesja może wygasnąć — zamykamy strumień po czasie bezczynności, klient połączy się ponownie
    const maxAge = setTimeout(() => res.end(), 10 * 60_000);
    req.raw.on('close', () => {
      clearInterval(ping);
      clearTimeout(maxAge);
      unsubscribe();
    });
  });
}
