/**
 * Limite de tamanho dos ficheiros aceites no upload.
 * O parser roda num Worker, mas um ficheiro demasiado grande ainda esgota a
 * memória do separador — o limite é validado antes de ler o ficheiro.
 */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Extensões aceites pelo input e pelo parser (texto = lido como string). */
export const UPLOAD_ACCEPT = '.xlsx,.xls,.xlsb,.xlsm,.ods,.csv,.tsv';

export const UPLOAD_FORMATS_LABEL = '.xlsx, .xls, .xlsb, .xlsm, .ods, .csv, .tsv';

/** Formatos lidos como texto (CSV/TSV) em vez de binário. */
export function isPlainTextUpload(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'csv' || ext === 'tsv';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Mensagem de erro quando o ficheiro excede o limite; `null` quando é aceite.
 */
export function validateUploadSize(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes <= MAX_UPLOAD_BYTES) return null;
  return `O ficheiro tem ${formatBytes(bytes)} e excede o limite de ${formatBytes(MAX_UPLOAD_BYTES)}. Divida a planilha ou reduza as colunas antes de importar.`;
}
