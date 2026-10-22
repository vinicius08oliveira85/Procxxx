import { describe, expect, it } from 'vitest';
import { maskSensitiveValue } from './maskSensitive';

describe('maskSensitiveValue', () => {
  it('mascara CPF mantendo o formato', () => {
    expect(maskSensitiveValue('123.456.789-00')).toBe('12*.***.***-00');
  });

  it('mascara e-mail preservando o domínio', () => {
    expect(maskSensitiveValue('maria.silva@empresa.com')).toBe('ma***@empresa.com');
  });

  it('mascara telefone com separadores', () => {
    expect(maskSensitiveValue('(11) 91234-5678')).toBe('(11) 91***-**78');
  });

  it('não altera nomes, códigos curtos nem números de 1–8 dígitos', () => {
    expect(maskSensitiveValue('José')).toBe('José');
    expect(maskSensitiveValue('SKU-1234')).toBe('SKU-1234');
    expect(maskSensitiveValue('2024')).toBe('2024');
  });

  it('mascara apenas a parte longa da sequência', () => {
    expect(maskSensitiveValue('CPF 12345678901 final')).toBe('CPF 12*******01 final');
  });
});
