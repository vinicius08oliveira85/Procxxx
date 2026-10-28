import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'motion/react';
import {
  isReducedMotion,
  motionConfigMode,
  persistMotionPreference,
  readStoredMotionPreference,
  type MotionPreference,
} from './motionPreference';
import { persistDensity, readStoredDensity, type Density } from './uiDensity';

type UiPreferencesContextValue = {
  preference: MotionPreference;
  systemReduced: boolean;
  /** Efeito final: `true` quando há de reduzir o movimento agora. */
  reduced: boolean;
  setPreference: (preference: MotionPreference) => void;
  density: Density;
  setDensity: (density: Density) => void;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

const QUERY = '(prefers-reduced-motion: reduce)';

function readSystemReduced(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Fonte única das preferências de interface (movimento e densidade).
 *
 * Cada preferência é espelhada num atributo do `<html>` — `data-reduce-motion`
 * e `data-density` — para o CSS em `index.css` aplicar exatamente o mesmo
 * estado que o React (e o `MotionConfig`) usa.
 */
export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<MotionPreference>(readStoredMotionPreference);
  const [systemReduced, setSystemReduced] = useState<boolean>(readSystemReduced);
  const [density, setDensityState] = useState<Density>(readStoredDensity);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const reduced = isReducedMotion(preference, systemReduced);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduced ? 'true' : 'false';
  }, [reduced]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const setPreference = useCallback((next: MotionPreference) => {
    setPreferenceState(next);
    persistMotionPreference(next);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    persistDensity(next);
  }, []);

  const value = useMemo(
    () => ({ preference, systemReduced, reduced, setPreference, density, setDensity }),
    [preference, systemReduced, reduced, setPreference, density, setDensity]
  );

  return (
    <UiPreferencesContext.Provider value={value}>
      <MotionConfig reducedMotion={motionConfigMode(preference)}>{children}</MotionConfig>
    </UiPreferencesContext.Provider>
  );
}

export function useUiPreferences(): UiPreferencesContextValue {
  const context = useContext(UiPreferencesContext);
  if (!context) {
    throw new Error('useUiPreferences deve ser usado dentro de <UiPreferencesProvider>');
  }
  return context;
}
