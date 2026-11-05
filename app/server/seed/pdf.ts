/** Minimalny poprawny PDF 1.4 z tekstem (Helvetica, ASCII) — do fikcyjnych załączników w danych demonstracyjnych. */
export function simplePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => `\\${m}`).replace(/[^\x20-\x7e]/g, '?');
  const content = [
    'BT',
    '/F1 16 Tf',
    '50 790 Td',
    ...lines.flatMap((line, i) => (i === 0 ? [`(${esc(line)}) Tj`, '/F1 11 Tf'] : ['0 -18 Td', `(${esc(line)}) Tj`])),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
