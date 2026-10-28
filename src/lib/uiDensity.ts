/**
 * Densidade da interface, escolhida em Preferências.
 *
 * - `comfortable`: espaçamento padrão entre linhas.
 * - `compact`: menos altura por linha, mais dados visíveis na tabela.
 */
export type Density = 'comfortable' | 'compact';

export const DEFAULT_DENSITY: Density = 'comfortable';

const STORAGE_KEY = 'lookupmaster:density';

export function isDensity(value: unknown): value is Density {
  return value === 'comfortable' || value === 'compact';
}

export function readStoredDensity(): Density {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isDensity(raw) ? raw : DEFAULT_DENSITY;
  } catch {
    // Modo privado / storage bloqueado: usa o padrão.
    return DEFAULT_DENSITY;
  }
}

export function persistDensity(density: Density): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // Sem persistência: a escolha vale apenas para esta sessão.
  }
}
