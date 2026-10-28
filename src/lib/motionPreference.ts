/**
 * Preferência de movimento escolhida na interface.
 *
 * - `system`: segue `prefers-reduced-motion` do sistema operacional.
 * - `reduce`: força movimento reduzido, mesmo que o sistema permita animações.
 * - `full`: mantém as animações completas, mesmo que o sistema peça redução.
 */
export type MotionPreference = 'system' | 'reduce' | 'full';

export const DEFAULT_MOTION_PREFERENCE: MotionPreference = 'system';

const STORAGE_KEY = 'lookupmaster:motion-preference';

export function isMotionPreference(value: unknown): value is MotionPreference {
  return value === 'system' || value === 'reduce' || value === 'full';
}

/** Resultado efetivo: é preciso reduzir o movimento agora? */
export function isReducedMotion(preference: MotionPreference, systemReduced: boolean): boolean {
  if (preference === 'reduce') return true;
  if (preference === 'full') return false;
  return systemReduced;
}

/** Valor equivalente para `MotionConfig.reducedMotion`. */
export function motionConfigMode(preference: MotionPreference): 'user' | 'always' | 'never' {
  if (preference === 'reduce') return 'always';
  if (preference === 'full') return 'never';
  return 'user';
}

export function readStoredMotionPreference(): MotionPreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isMotionPreference(raw) ? raw : DEFAULT_MOTION_PREFERENCE;
  } catch {
    // Modo privado / storage bloqueado: usa o padrão sem rebentar a app.
    return DEFAULT_MOTION_PREFERENCE;
  }
}

export function persistMotionPreference(preference: MotionPreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Sem persistência: a escolha vale apenas para esta sessão.
  }
}
