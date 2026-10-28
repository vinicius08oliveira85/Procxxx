import { CheckCircle2, Settings, Upload, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export type AppStep = 'upload' | 'configure' | 'result';

const STEPS: { id: AppStep; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'upload', label: 'Upload', short: 'Upload', icon: Upload },
  { id: 'configure', label: 'Configurar', short: 'Config', icon: Settings },
  { id: 'result', label: 'Resultado', short: 'Resultado', icon: CheckCircle2 },
];

/**
 * Indicador de progresso único da aplicação (substitui o strip da landing, o
 * stepper circular e o indicador do Resultado, que tinham escalas diferentes).
 */
export function StepIndicator({ currentStep, compact }: { currentStep: AppStep; compact?: boolean }) {
  const activeIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <ol
      aria-label="Etapas"
      className={cn(
        'mica flex items-center gap-1 rounded-2xl border border-black/[0.06] p-1 dark:border-white/10',
        compact && 'gap-0.5 p-0.5'
      )}
    >
      {STEPS.map((step, index) => {
        const active = step.id === currentStep;
        const done = index < activeIndex;
        return (
          <li key={step.id} className="flex items-center">
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-bold sm:px-3',
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : done
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black',
                  active ? 'bg-white/20' : done ? 'bg-emerald-500/15' : 'bg-black/5 dark:bg-white/10'
                )}
              >
                {done ? <CheckCircle2 size={13} aria-hidden /> : index + 1}
              </span>
              <span className={cn('truncate', compact ? 'hidden sm:inline' : 'hidden md:inline')}>
                {step.label}
              </span>
              <span className={cn('truncate', compact ? 'sm:hidden' : 'md:hidden')}>{step.short}</span>
            </span>
            {index < STEPS.length - 1 && (
              <span aria-hidden className="mx-0.5 h-px w-2.5 bg-black/15 dark:bg-white/15 sm:w-4" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
