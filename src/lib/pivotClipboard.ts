import type { PivotColumnHeader, PivotTreeNode } from './pivotEngine';

function tsvEscapeCell(raw: string): string {
  if (/[\t\n\r"]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rowLabelTsv(node: PivotTreeNode): string {
  const label = node.segmentLabel || '—';
  return `${'  '.repeat(Math.max(0, node.depth))}${label}`;
}

export function buildPivotTableTsv(
  dataHeaders: PivotColumnHeader[],
  flatRows: PivotTreeNode[],
  grandTotal: number[],
  formatCell: (value: number, columnIndex: number) => string,
  rowHeaderLabel = 'Rótulos de Linha'
): string {
  const lines: string[] = [];
  lines.push(
    [rowHeaderLabel, ...dataHeaders.map((h) => h.label)].map(tsvEscapeCell).join('\t')
  );
  for (const node of flatRows) {
    const cells = [
      rowLabelTsv(node),
      ...node.aggregates.map((v, i) => formatCell(v, i)),
    ].map(tsvEscapeCell);
    lines.push(cells.join('\t'));
  }
  lines.push(
    ['Total Geral', ...grandTotal.map((v, i) => formatCell(v, i))].map(tsvEscapeCell).join('\t')
  );
  return lines.join('\n');
}

export function buildPivotTableHtml(
  dataHeaders: PivotColumnHeader[],
  flatRows: PivotTreeNode[],
  grandTotal: number[],
  formatCell: (value: number, columnIndex: number) => string,
  rowHeaderLabel = 'Rótulos de Linha'
): string {
  const headerBg = '#1b5e3b';
  const subtotalBg = '#c8e6c9';
  const totalBg = '#eceff1';
  let html =
    '<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:Segoe UI,system-ui,sans-serif;font-size:11pt;">';
  html += `<thead><tr style="background:${headerBg};color:#fff;font-weight:bold;">`;
  html += `<th align="left">${htmlEscape(rowHeaderLabel)}</th>`;
  for (const h of dataHeaders) {
    html += `<th align="right">${htmlEscape(h.label)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const node of flatRows) {
    const hasKids = node.children.length > 0;
    const bg = node.depth === 0 && hasKids ? subtotalBg : '#ffffff';
    const pad = 8 + node.depth * 12;
    html += `<tr style="background:${bg};">`;
    html += `<td align="left" style="padding-left:${pad}px;">${htmlEscape(node.segmentLabel || '—')}</td>`;
    for (let i = 0; i < node.aggregates.length; i++) {
      html += `<td align="right">${htmlEscape(formatCell(node.aggregates[i], i))}</td>`;
    }
    html += '</tr>';
  }
  html += `<tr style="font-weight:bold;border-top:3px double #2e7d32;background:${totalBg};">`;
  html += `<td align="left">${htmlEscape('Total Geral')}</td>`;
  for (let i = 0; i < grandTotal.length; i++) {
    html += `<td align="right">${htmlEscape(formatCell(grandTotal[i], i))}</td>`;
  }
  html += '</tr></tbody></table>';
  return html;
}

/**
 * Copia TSV + HTML para a área de transferência (Excel/Word costumam preferir HTML quando disponível).
 */
export async function copyPivotTableTsvAndHtml(tsv: string, html: string): Promise<void> {
  const plainBlob = () => new Blob([tsv], { type: 'text/plain;charset=utf-8' });
  const htmlBlob = () => new Blob([html], { type: 'text/html;charset=utf-8' });

  if (typeof navigator !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': plainBlob(),
          'text/html': htmlBlob(),
        }),
      ]);
      return;
    } catch {
      /* tenta fallbacks */
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(tsv);
    return;
  }

  throw new Error('Clipboard não disponível neste ambiente.');
}
