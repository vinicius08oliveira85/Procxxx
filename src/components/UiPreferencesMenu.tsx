import { useEffect, useId, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUiPreferences } from '../lib/uiPreferences';
import type { MotionPreference } from '../lib/motionPreference';
import type { Density } from '../lib/uiDensity';

const MOTION_OPTIONS: { id: MotionPreference; label: string; title: string }[] = [
  { id: 'system', label: 'Sistema', title: 'Segue a definição de movimento do sistema operacional' },
  { id: 'reduce', label: 'Reduzido', title: 'Desliga fundos animados e efeitos de movimento' },
  { id: 'full', label: 'Completo', title: 'Mantém todas as animações, mesmo que o sistema peça redução' },
];

const DENSITY_OPTIONS: { id: Density; label: string; title: string }[] = [
  { id: 'comfortable', label: 'Confortável', title: 'Espaçamento padrão entre linhas' },
  { id: 'compact', label: 'Compacta', title: 'Mais linhas visíveis na tabela de resultados' },
];

/** Cabeçalhos da landing/Configurar são escuros fixos; o do Resultado segue o tema. */
type Tone = 'dark' | 'auto';

function SegmentedControl<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  isDark,
}: {
  id: string;
  label: string;
  value: T;
  options: { id: T; label: string; title: string }[];
  onChange: (id: T) => void;
  isDark: boolean;
}) {
  const labelId = `${id}-label`;
  return (
    <div className="mt-3">
      <p className="text-xs font-bold" id={labelId}>
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={cn(
          'mt-1.5 flex gap-1 rounded-xl border p-1',
          isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5'
        )}
      >
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.title}
              onClick={() => onChange(option.id)}
              className={cn(
                'min-h-[36px] flex-1 rounded-lg px-2 text-xs font-bold transition-colors',
                active
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : isDark
                    ? 'text-[#c3c6d7] hover:bg-white/10 hover:text-white'
                    : 'text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UiPreferencesMenu({ tone = 'auto' }: { tone?: Tone }) {
  const { preference, systemReduced, reduced, setPreference, density, setDensity } = useUiPreferences();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const isDark = tone === 'dark';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Preferências de interface"
        title="Preferências de interface"
        className={cn(
          'rounded-full p-2 transition-all active:scale-95',
          isDark
            ? 'text-[#c3c6d7] hover:bg-white/10 hover:text-white'
            : 'text-zinc-600 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'
        )}
      >
        <SlidersHorizontal size={20} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Preferências de interface"
          className={cn(
            'absolute right-0 top-full z-[250] mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl',
            isDark
              ? 'border-white/10 bg-[#1c1b1b]/95 text-[#e5e2e1]'
              : 'border-black/10 bg-white/95 text-zinc-900 dark:border-white/10 dark:bg-zinc-900/95 dark:text-zinc-100'
          )}
        >
          <p className="font-jakarta text-[11px] font-bold uppercase tracking-widest opacity-70">
            Preferências de interface
          </p>

          <SegmentedControl
            id={`${panelId}-motion`}
            label="Movimento"
            value={preference}
            options={MOTION_OPTIONS}
            onChange={setPreference}
            isDark={isDark}
          />
          <p className="mt-2 text-[11px] leading-snug opacity-70">
            {reduced ? 'Animações reduzidas' : 'Animações completas'} — a escolha fica guardada neste navegador.
          </p>

          {preference === 'full' && systemReduced && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
              O sistema pede movimento reduzido; esta opção ignora essa definição.
            </p>
          )}

          <SegmentedControl
            id={`${panelId}-density`}
            label="Densidade"
            value={density}
            options={DENSITY_OPTIONS}
            onChange={setDensity}
            isDark={isDark}
          />
          <p className="mt-2 text-[11px] leading-snug opacity-70">
            {density === 'compact' ? 'Compacta' : 'Confortável'} — altura das linhas da tabela de resultados.
          </p>
        </div>
      )}
    </div>
  );
}
