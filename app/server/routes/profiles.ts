import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { actorOf, requirePatient, requireStaff } from '../auth/sessions.js';
import { listUsers } from '../auth/users.js';
import { CONSENT_TEMPLATES } from '../content/aestheticConsents.js';
import { clinicProfile, type ProfileFeature } from '../content/clinicProfiles.js';
import { body, IdParams, params, query, zDate, zId, zIso } from '../lib/http.js';
import { badRequest, forbidden, notFound } from '../lib/util.js';
import {
  addLot,
  addProcedurePhoto,
  aestheticForPatient,
  aestheticTasks,
  approveConsentTemplate,
  complicationReportData,
  consentPrintHtml,
  consentTemplatesFor,
  createComplication,
  createProcedure,
  createProduct,
  getImageConsent,
  getProcedure,
  listComplications,
  listConsents,
  listProcedures,
  listProducts,
  lotRecall,
  MAP_VIEWS,
  markConsentRead,
  PHOTO_ANGLES,
  PRODUCT_CATEGORIES,
  PRODUCT_KINDS,
  recordConsentSigned,
  REPORT_TO,
  requestConsent,
  SERIOUSNESS,
  setImageConsent,
  setLotActive,
  signProcedure,
  UNITS,
  updateComplication,
  updateProcedure,
  updateProduct,
  withdrawConsent,
} from '../services/aesthetic.js';
import { applyProfile, listProfiles, orgFeatures, orgProfiles, removeProfile, requireFeature } from '../services/clinicProfile.js';
import { getClinicSettings, listPractitioners, listServices, updateClinicSettings } from '../services/directory.js';
import { patientOrgIds, staffOrgId } from '../services/orgs.js';
import {
  addPlanItem,
  bzodList,
  closePlan,
  createDeclaration,
  createPlan,
  DECL_KINDS,
  decideDeclaration,
  IPOM_GROUPS,
  IPOM_KINDS,
  listDeclarations,
  listPlans,
  planForPatient,
  pozForPatient,
  recordBzod,
  setCoordinator,
  updatePlanItem,
} from '../services/poz.js';
import { createDocument, registerUpload } from '../services/records.js';
import { getDb } from '../db.js';

/** Profile placówek (POZ, medycyna estetyczna, …): wybór profilu, funkcje POZ i karty zabiegów. */
export async function profileRoutes(app: FastifyInstance): Promise<void> {
  const staffOrg = (req: FastifyRequest, roles?: Parameters<typeof requireStaff>[1]) => {
    const auth = requireStaff(req, roles);
    const orgId = staffOrgId(auth.user);
    if (!orgId) throw badRequest('org_required');
    return { auth, orgId };
  };
  const feature = (req: FastifyRequest, f: ProfileFeature, roles?: Parameters<typeof requireStaff>[1]) => {
    const ctx = staffOrg(req, roles);
    requireFeature(ctx.orgId, f);
    return ctx;
  };
  const PatientParams = z.object({ id: zId });

  // --- profil placówki ---------------------------------------------------------------------------------------------
  app.get('/api/staff/clinic-profile', async (req) => {
    const { orgId } = staffOrg(req);
    return { profiles: orgProfiles(orgId).map((p) => ({ id: p.id, name: p.name })), features: orgFeatures(orgId) };
  });

  app.get('/api/admin/clinic-profiles', async (req) => {
    const { orgId } = staffOrg(req, ['admin']);
    return { items: await listProfiles(orgId), ipomLimits: getClinicSettings(orgId).ipomLimits ?? {} };
  });

  app.post('/api/admin/clinic-profiles/:id/apply', async (req) => {
    const { orgId } = staffOrg(req, ['admin']);
    const { id } = params(req, z.object({ id: z.string().max(40) }));
    if (!clinicProfile(id)) throw notFound('profile_not_found');
    return applyProfile(actorOf(req), id, orgId);
  });

  app.delete('/api/admin/clinic-profiles/:id', async (req) => {
    const { orgId } = staffOrg(req, ['admin']);
    const { id } = params(req, z.object({ id: z.string().max(40) }));
    removeProfile(actorOf(req), id, orgId);
    return { ok: true };
  });

  app.put('/api/admin/ipom-limits', async (req) => {
    const { orgId } = staffOrg(req, ['admin']);
    const lim = z.number().int().min(0).max(100).optional();
    const input = body(req, z.object({ limits: z.object({ wizyta: lim, badanie: lim, konsultacja: lim, edukacja: lim, dietetyk: lim }) }));
    return { ipomLimits: updateClinicSettings(actorOf(req), { ipomLimits: input.limits }, orgId).ipomLimits };
  });

  app.get('/api/staff/profile-tasks', async (req) => {
    const { auth, orgId } = staffOrg(req);
    const features = orgFeatures(orgId);
    const out: Record<string, unknown> = { features };
    if (features.includes('poz')) {
      const n = (sql: string, ...a: string[]) => Number((getDb().prepare(sql).get(...a) as { n: number }).n);
      const plans = await listPlans(actorOf(req), orgId, {});
      out.poz = {
        declarationsPending: n("SELECT COUNT(*) AS n FROM poz_declaration WHERE org_id = ? AND status = 'zlozona'", orgId),
        ipomOverdue: plans.reduce((s, p) => s + p.overdue, 0),
        ipomMine: plans.filter((p) => p.coordinator === auth.user.display_name).length,
        activePlans: plans.length,
      };
    }
    if (features.includes('aesthetic')) out.aesthetic = aestheticTasks(orgId);
    return out;
  });

  // --- POZ: deklaracje ---------------------------------------------------------------------------------------------
  app.get('/api/staff/poz/meta', async (req) => {
    const { orgId } = feature(req, 'poz');
    return {
      kinds: DECL_KINDS,
      groups: IPOM_GROUPS,
      itemKinds: IPOM_KINDS,
      practitioners: (await listPractitioners()).map((p) => ({ id: p.id, name: p.name, profession: p.profession })),
      coordinators: listUsers({ orgId, staffOnly: true })
        .filter((u) => u.status === 'active')
        .map((u) => ({ userId: u.id, name: u.display_name })),
      limits: getClinicSettings(orgId).ipomLimits ?? {},
    };
  });

  app.get('/api/staff/poz/declarations', async (req) => {
    const { orgId } = feature(req, 'poz');
    const q = query(req, z.object({ status: z.enum(['zlozona', 'przyjeta', 'odrzucona', 'wycofana', 'zastapiona']).optional(), kind: z.enum(DECL_KINDS as [string, ...string[]]).optional(), patientId: zId.optional() }));
    return listDeclarations(actorOf(req), orgId, q as Parameters<typeof listDeclarations>[2]);
  });

  app.post('/api/staff/poz/declarations', async (req) => {
    const { orgId } = feature(req, 'poz');
    const input = body(req, z.object({ patientId: zId, kind: z.enum(['lekarz', 'pielegniarka', 'polozna']), practitionerId: zId, source: z.enum(['papier', 'ikp']), submittedOn: zDate.optional() }));
    return createDeclaration(actorOf(req), orgId, input);
  });

  app.post('/api/staff/poz/declarations/:id/decision', async (req) => {
    const { orgId } = feature(req, 'poz');
    const { id } = params(req, IdParams);
    const input = body(req, z.object({ action: z.enum(['accept', 'reject', 'withdraw']), reason: z.string().max(300).optional() }));
    return decideDeclaration(actorOf(req), orgId, id, input);
  });

  // --- POZ: opieka koordynowana (IPOM) -----------------------------------------------------------------------------
  const ItemSchema = z.object({ kind: z.enum(IPOM_KINDS), title: z.string().min(1).max(200), dueOn: zDate.optional() });

  app.get('/api/staff/poz/ipom', async (req) => {
    const { auth, orgId } = feature(req, 'poz', ['practitioner', 'reception']);
    const q = query(req, z.object({ overdue: z.enum(['1']).optional(), mine: z.enum(['1']).optional() }));
    return { items: await listPlans(actorOf(req), orgId, { overdueOnly: !!q.overdue, coordinatorUserId: q.mine ? auth.user.id : undefined }) };
  });

  app.get('/api/staff/patients/:id/ipom', async (req) => {
    const { orgId } = feature(req, 'poz', ['practitioner', 'reception']);
    const { id } = params(req, PatientParams);
    return planForPatient(actorOf(req), orgId, id);
  });

  app.post('/api/staff/patients/:id/ipom', async (req) => {
    const { auth, orgId } = feature(req, 'poz', ['practitioner']);
    const { id } = params(req, PatientParams);
    const input = body(req, z.object({ groups: z.array(z.string().max(40)).min(1).max(8), coordinatorUserId: zId.nullable().optional(), note: z.string().max(2000).optional(), items: z.array(ItemSchema).max(40).default([]) }));
    return createPlan(auth.user, actorOf(req), orgId, { patientId: id, ...input });
  });

  app.post('/api/staff/poz/ipom/:id/items', async (req) => {
    const { orgId } = feature(req, 'poz', ['practitioner', 'reception']);
    const { id } = params(req, IdParams);
    return addPlanItem(actorOf(req), orgId, id, body(req, ItemSchema));
  });

  app.put('/api/staff/poz/ipom/:id/items/:itemId', async (req) => {
    const { orgId } = feature(req, 'poz', ['practitioner', 'reception']);
    const { id, itemId } = params(req, z.object({ id: zId, itemId: zId }));
    const input = body(req, z.object({ status: z.enum(['zaplanowane', 'zrealizowane', 'odwolane']).optional(), doneOn: zDate.optional(), dueOn: zDate.nullable().optional(), note: z.string().max(500).optional() }));
    return updatePlanItem(actorOf(req), orgId, id, itemId, input);
  });

  app.put('/api/staff/poz/ipom/:id/coordinator', async (req) => {
    const { auth, orgId } = feature(req, 'poz', ['practitioner', 'reception']);
    const { id } = params(req, IdParams);
    const { coordinatorUserId } = body(req, z.object({ coordinatorUserId: zId.nullable() }));
    return setCoordinator(auth.user, actorOf(req), orgId, id, coordinatorUserId);
  });

  app.post('/api/staff/poz/ipom/:id/close', async (req) => {
    const { orgId } = feature(req, 'poz', ['practitioner']);
    const { id } = params(req, IdParams);
    return closePlan(actorOf(req), orgId, id);
  });

  // --- POZ: bilans „Moje Zdrowie” ----------------------------------------------------------------------------------
  app.get('/api/staff/poz/bzod', async (req) => {
    const { orgId } = feature(req, 'poz', ['practitioner', 'reception']);
    return bzodList(actorOf(req), orgId);
  });

  app.post('/api/staff/patients/:id/bzod', async (req) => {
    const { orgId } = feature(req, 'poz', ['practitioner', 'reception']);
    const { id } = params(req, PatientParams);
    const { doneOn } = body(req, z.object({ doneOn: zDate }));
    return recordBzod(actorOf(req), orgId, id, doneOn);
  });

  // --- Medycyna estetyczna: produkty i partie ----------------------------------------------------------------------
  app.get('/api/staff/aesthetic/meta', async (req) => {
    const { orgId } = feature(req, 'aesthetic');
    return {
      kinds: PRODUCT_KINDS,
      categories: PRODUCT_CATEGORIES,
      units: UNITS,
      angles: PHOTO_ANGLES,
      views: MAP_VIEWS,
      seriousness: SERIOUSNESS,
      reportTo: REPORT_TO,
      templates: consentTemplatesFor(orgId).map((t) => ({ id: t.id, title: t.title, version: t.version, approval: t.approval })),
      services: (await listServices()).map((s) => ({ id: s.id, name: s.name, price: s.price, vat: s.vat, requiresPhysician: s.requiresPhysician, consentTemplate: s.consentTemplate, controlAfterDays: s.controlAfterDays, purposeDefault: s.purposeDefault })),
    };
  });

  app.get('/api/staff/aesthetic/products', async (req) => {
    const { orgId } = feature(req, 'aesthetic');
    return { items: listProducts(orgId) };
  });

  app.post('/api/staff/aesthetic/products', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'admin', 'reception']);
    const input = body(req, z.object({ name: z.string().min(1).max(120), kind: z.enum(PRODUCT_KINDS), category: z.enum(PRODUCT_CATEGORIES), manufacturer: z.string().max(120).optional(), unit: z.enum(UNITS), requiresPhysician: z.boolean().optional() }));
    return createProduct(actorOf(req), orgId, input);
  });

  app.put('/api/staff/aesthetic/products/:id', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'admin', 'reception']);
    const { id } = params(req, IdParams);
    return updateProduct(actorOf(req), orgId, id, body(req, z.object({ active: z.boolean().optional(), requiresPhysician: z.boolean().optional(), manufacturer: z.string().max(120).optional() })));
  });

  app.post('/api/staff/aesthetic/products/:id/lots', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'admin', 'reception']);
    const { id } = params(req, IdParams);
    return addLot(actorOf(req), orgId, id, body(req, z.object({ lot: z.string().min(1).max(60), expiry: zDate, udi: z.string().max(120).optional(), receivedOn: zDate.optional(), note: z.string().max(300).optional() })));
  });

  app.put('/api/staff/aesthetic/lots/:id', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'admin', 'reception']);
    const { id } = params(req, IdParams);
    return setLotActive(actorOf(req), orgId, id, body(req, z.object({ active: z.boolean() })).active);
  });

  app.get('/api/staff/aesthetic/lots/:id/recall', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'admin']);
    const { id } = params(req, IdParams);
    return lotRecall(actorOf(req), orgId, id);
  });

  // --- karta zabiegu ------------------------------------------------------------------------------------------------
  const ItemIn = z.object({ productId: zId, lotId: zId, quantity: z.number().positive().max(1000), area: z.string().max(80).default('') });
  const PointIn = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), view: z.enum(MAP_VIEWS), quantity: z.number().min(0).max(1000).optional(), item: z.number().int().min(0).max(19).optional(), label: z.string().max(60).optional() });
  const ProcIn = z.object({
    appointmentId: zId.optional(),
    serviceId: zId.optional(),
    title: z.string().min(1).max(160),
    purpose: z.enum(['estetyczny', 'leczniczy']),
    indication: z.string().max(500).optional(),
    performedAt: zIso.optional(),
    items: z.array(ItemIn).max(20).default([]),
    points: z.array(PointIn).max(120).default([]),
    notes: z.string().max(4000).optional(),
    consentId: zId.nullable().optional(),
    aftercare: z.string().max(4000).optional(),
    controlOn: zDate.nullable().optional(),
    nextOn: zDate.nullable().optional(),
  });

  app.get('/api/staff/aesthetic/procedures', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner']);
    const q = query(req, z.object({ patientId: zId.optional() }));
    return { items: await listProcedures(actorOf(req), orgId, q) };
  });

  app.post('/api/staff/aesthetic/procedures', async (req) => {
    const { auth, orgId } = feature(req, 'aesthetic', ['practitioner']);
    const input = body(req, ProcIn.extend({ patientId: zId }));
    return createProcedure(auth.user, actorOf(req), orgId, input);
  });

  app.get('/api/staff/aesthetic/procedures/:id', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner']);
    const { id } = params(req, IdParams);
    return getProcedure(actorOf(req), orgId, id);
  });

  app.put('/api/staff/aesthetic/procedures/:id', async (req) => {
    const { auth, orgId } = feature(req, 'aesthetic', ['practitioner']);
    const { id } = params(req, IdParams);
    return updateProcedure(auth.user, actorOf(req), orgId, id, body(req, ProcIn.partial()));
  });

  app.post('/api/staff/aesthetic/procedures/:id/sign', async (req) => {
    const { auth, orgId } = feature(req, 'aesthetic', ['practitioner']);
    const { id } = params(req, IdParams);
    return signProcedure(auth.user, actorOf(req), orgId, id);
  });

  app.post('/api/staff/aesthetic/procedures/:id/photos', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner']);
    const { id } = params(req, IdParams);
    const file = await req.file({ limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
    if (!file) throw badRequest('file_required');
    const data = await file.toBuffer();
    if (file.file.truncated) throw badRequest('file_too_large');
    const field = (k: string) => (file.fields[k] as { value?: string } | undefined)?.value;
    const phase = z.enum(['przed', 'po']).parse(field('phase'));
    const angle = z.enum(PHOTO_ANGLES).parse(field('angle'));
    return addProcedurePhoto(actorOf(req), orgId, id, { data, filename: file.filename, contentType: file.mimetype, phase, angle });
  });

  // --- zgody -------------------------------------------------------------------------------------------------------
  app.get('/api/staff/aesthetic/consent-templates', async (req) => {
    const { orgId } = feature(req, 'aesthetic');
    return { items: consentTemplatesFor(orgId) };
  });

  app.post('/api/staff/aesthetic/consent-templates/:id/approve', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner']);
    const { id } = params(req, z.object({ id: z.enum(CONSENT_TEMPLATES.map((t) => t.id) as [string, ...string[]]) }));
    const { approvedBy } = body(req, z.object({ approvedBy: z.string().min(5).max(160) }));
    return approveConsentTemplate(actorOf(req), orgId, id, approvedBy);
  });

  app.get('/api/staff/patients/:id/procedure-consents', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'reception']);
    const { id } = params(req, PatientParams);
    return { items: listConsents(actorOf(req), orgId, id), image: getImageConsent(orgId, `Patient/${id}`) };
  });

  app.post('/api/staff/patients/:id/procedure-consents', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'reception']);
    const { id } = params(req, PatientParams);
    const { templateId } = body(req, z.object({ templateId: z.string().max(40) }));
    return requestConsent(actorOf(req), orgId, id, templateId);
  });

  app.get('/api/staff/aesthetic/consents/:id/print', async (req, reply) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'reception']);
    const { id } = params(req, IdParams);
    return reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(await consentPrintHtml(actorOf(req), orgId, id));
  });

  /** Podpisana zgoda: data, sposób podpisu i opcjonalnie skan (PDF/JPG/PNG) dołączany do dokumentacji pacjenta. */
  app.post('/api/staff/aesthetic/consents/:id/signed', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'reception']);
    const { id } = params(req, IdParams);
    let input: { signedOn: string; method: 'papier' | 'podpis-kwalifikowany' };
    let documentId: string | undefined;
    if (req.isMultipart()) {
      const file = await req.file({ limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
      if (!file) throw badRequest('file_required');
      const data = await file.toBuffer();
      if (file.file.truncated) throw badRequest('file_too_large');
      const field = (k: string) => (file.fields[k] as { value?: string } | undefined)?.value;
      input = z.object({ signedOn: zDate, method: z.enum(['papier', 'podpis-kwalifikowany']) }).parse({ signedOn: field('signedOn'), method: field('method') });
      const row = getDb().prepare('SELECT patient_ref, template_id FROM procedure_consent WHERE id = ? AND org_id = ?').get(id, orgId) as { patient_ref: string; template_id: string } | undefined;
      if (!row) throw notFound('consent_not_found');
      const upload = await registerUpload(actorOf(req), { data, filename: file.filename, contentType: file.mimetype });
      const doc = await createDocument(actorOf(req), { patientId: row.patient_ref.split('/')[1] ?? '', title: `Zgoda na zabieg — podpisana (${CONSENT_TEMPLATES.find((t) => t.id === row.template_id)?.title ?? row.template_id})`.slice(0, 200), kind: 'other', binaryId: upload.binaryId });
      documentId = doc.id;
    } else {
      input = body(req, z.object({ signedOn: zDate, method: z.enum(['papier', 'podpis-kwalifikowany']) }));
    }
    return recordConsentSigned(actorOf(req), orgId, id, { ...input, documentId });
  });

  app.post('/api/staff/aesthetic/consents/:id/withdraw', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'reception']);
    const { id } = params(req, IdParams);
    return withdrawConsent(actorOf(req), id, { orgId });
  });

  app.put('/api/staff/patients/:id/image-consent', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner', 'reception']);
    const { id } = params(req, PatientParams);
    return setImageConsent(actorOf(req), orgId, `Patient/${id}`, body(req, z.object({ documentation: z.boolean().optional(), marketing: z.boolean().optional() })));
  });

  // --- powikłania --------------------------------------------------------------------------------------------------
  app.get('/api/staff/aesthetic/complications', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner']);
    const q = query(req, z.object({ status: z.enum(['otwarte', 'zamkniete']).optional() }));
    return { items: await listComplications(actorOf(req), orgId, q) };
  });

  app.post('/api/staff/aesthetic/complications', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner']);
    const input = body(req, z.object({ procedureId: zId, noticedOn: zDate, description: z.string().min(1).max(4000), seriousness: z.enum(SERIOUSNESS), actions: z.string().max(2000).optional(), reportTo: z.enum(REPORT_TO), reportedOn: zDate.optional(), reportRef: z.string().max(120).optional() }));
    return createComplication(actorOf(req), orgId, input);
  });

  app.put('/api/staff/aesthetic/complications/:id', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner']);
    const { id } = params(req, IdParams);
    return updateComplication(actorOf(req), orgId, id, body(req, z.object({ status: z.enum(['otwarte', 'zamkniete']).optional(), actions: z.string().max(2000).optional(), reportedOn: zDate.nullable().optional(), reportRef: z.string().max(120).optional(), reportTo: z.enum(REPORT_TO).optional() })));
  });

  app.get('/api/staff/aesthetic/complications/:id/report', async (req) => {
    const { orgId } = feature(req, 'aesthetic', ['practitioner']);
    const { id } = params(req, IdParams);
    return complicationReportData(actorOf(req), orgId, id);
  });

  // --- pacjent -----------------------------------------------------------------------------------------------------
  app.get('/api/me/clinics', async (req) => {
    const auth = requirePatient(req);
    const orgIds = await patientOrgIds(auth.patientRef);
    const clinics = orgIds.map((orgId) => ({ orgId, name: getClinicSettings(orgId).name, features: orgFeatures(orgId) }));
    return { clinics, features: [...new Set(clinics.flatMap((c) => c.features))] };
  });

  app.get('/api/me/poz', async (req) => {
    const auth = requirePatient(req);
    return pozForPatient(auth.patientRef);
  });

  app.get('/api/me/aesthetic', async (req) => {
    const auth = requirePatient(req);
    return aestheticForPatient(auth.patientRef);
  });

  app.post('/api/me/aesthetic/consents/:id/read', async (req) => {
    const auth = requirePatient(req);
    const { id } = params(req, IdParams);
    markConsentRead(actorOf(req), auth.patientRef, id);
    return { ok: true };
  });

  app.post('/api/me/aesthetic/consents/:id/withdraw', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    const { id } = params(req, IdParams);
    return withdrawConsent(actorOf(req), id, { patientRef: auth.patientRef });
  });

  app.put('/api/me/aesthetic/image-consent', async (req) => {
    const auth = requirePatient(req, { ownOnly: true });
    const input = body(req, z.object({ orgId: zId, documentation: z.boolean().optional(), marketing: z.boolean().optional() }));
    const known = (await patientOrgIds(auth.patientRef)).includes(input.orgId) || !!getDb().prepare('SELECT 1 FROM image_consent WHERE org_id = ? AND patient_ref = ?').get(input.orgId, auth.patientRef);
    if (!known) throw forbidden('org_not_linked');
    return setImageConsent(actorOf(req), input.orgId, auth.patientRef, { documentation: input.documentation, marketing: input.marketing });
  });
}
