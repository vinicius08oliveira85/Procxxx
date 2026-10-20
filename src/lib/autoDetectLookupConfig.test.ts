import { describe, expect, it } from 'vitest';
import { computeAutoDetectLookup } from './autoDetectLookupConfig';

describe('computeAutoDetectLookup', () => {
  it('usa cabeçalhos com o mesmo nome', () => {
    const r = computeAutoDetectLookup(['CPF', 'Nome'], ['CPF', 'Cidade']);
    expect(r.keyA).toBe('CPF');
    expect(r.keyB).toBe('CPF');
    expect(r.selectedColsB).toEqual(['Cidade']);
  });

  it('não confunde "Cidade" com a chave "id"', () => {
    const r = computeAutoDetectLookup(['Cidade', 'Bairro'], ['Cidade', 'Identificador']);
    // Primeiro tenta nome idêntico: Cidade/Cidade.
    expect(r.keyA).toBe('Cidade');
    expect(r.keyB).toBe('Cidade');
  });

  it('aceita chave composta como palavra inteira', () => {
    const r = computeAutoDetectLookup(['Código do cliente'], ['Código', 'Razão social']);
    expect(r.keyA).toBe('Código do cliente');
    expect(r.keyB).toBe('Código');
  });

  it('retorna vazio sem cabeçalhos', () => {
    expect(computeAutoDetectLookup([], ['A'])).toEqual({ keyA: '', keyB: '', selectedColsB: [] });
  });
});
