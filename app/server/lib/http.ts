import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { badRequest } from './util.js';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      'validation_failed',
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

export const body = <T extends z.ZodType>(req: FastifyRequest, schema: T) => parse(schema, req.body ?? {});
export const query = <T extends z.ZodType>(req: FastifyRequest, schema: T) => parse(schema, req.query ?? {});
export const params = <T extends z.ZodType>(req: FastifyRequest, schema: T) => parse(schema, req.params ?? {});

export const zId = z.string().regex(/^[A-Za-z0-9\-.]{1,64}$/);
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const zIso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid datetime');
export const IdParams = z.object({ id: zId });

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}
