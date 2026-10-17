import fs from 'node:fs';
import path from 'node:path';

/**
 * Wykaz składników oprogramowania (A18.9, CycloneDX). Obraz produkcyjny zawiera dist/sbom.cdx.json
 * wygenerowany przy budowaniu (Dockerfile); lokalnie: `npm run sbom`.
 */

const CANDIDATES = () => [process.env.SBOM_PATH, path.resolve('dist/sbom.cdx.json'), path.resolve('sbom.cdx.json')].filter((p): p is string => !!p);

export function sbomFile(): string | undefined {
  return CANDIDATES().find((p) => fs.existsSync(p));
}

export function sbomSummary(): { present: false } | { present: true; file: string; components: number; generatedAt?: string; format: string } {
  const file = sbomFile();
  if (!file) return { present: false };
  try {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as { bomFormat?: string; specVersion?: string; components?: unknown[]; metadata?: { timestamp?: string } };
    return { present: true, file, components: doc.components?.length ?? 0, generatedAt: doc.metadata?.timestamp, format: `${doc.bomFormat ?? '?'} ${doc.specVersion ?? ''}`.trim() };
  } catch {
    return { present: false };
  }
}
