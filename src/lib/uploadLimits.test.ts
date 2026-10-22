import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  isPlainTextUpload,
  MAX_UPLOAD_BYTES,
  validateUploadSize,
} from './uploadLimits';

describe('validateUploadSize', () => {
  it('aceita ficheiros até 50 MB', () => {
    expect(validateUploadSize(0)).toBeNull();
    expect(validateUploadSize(1024)).toBeNull();
    expect(validateUploadSize(MAX_UPLOAD_BYTES)).toBeNull();
  });

  it('recusa acima de 50 MB com mensagem em MB', () => {
    const message = validateUploadSize(MAX_UPLOAD_BYTES + 1);
    expect(message).toContain('excede o limite de 50.0 MB');
  });

  it('formata tamanhos legíveis', () => {
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50.0 MB');
    expect(formatBytes(120 * 1024 * 1024)).toBe('120 MB');
  });
});

describe('isPlainTextUpload', () => {
  it('reconhece CSV/TSV (case-insensitive)', () => {
    expect(isPlainTextUpload('dados.csv')).toBe(true);
    expect(isPlainTextUpload('DADOS.TSV')).toBe(true);
    expect(isPlainTextUpload('base.xlsx')).toBe(false);
    expect(isPlainTextUpload('semextensao')).toBe(false);
  });
});
