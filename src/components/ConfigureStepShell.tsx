import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, HelpCircle, Moon, RotateCcw, Rocket, Sun } from 'lucide-react';
import { cn } from '../lib/utils';
import { StepIndicator } from './StepIndicator';
import { UiPreferencesMenu } from './UiPreferencesMenu';

export interface ConfigureStepShellProps {
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  showNext: boolean;
  onExecute: () => void;
  executeDisabled: boolean;
  executeLoading: boolean;
  isDarkMode: boolean;
  onToggleDark: () => void;
  onReset: () => void;
}

/**
 * Layout full-page da etapa Configurar: header fixo, stepper e footer.
 * As superfícies usam o mesmo par claro/escuro do resto da aplicação.
 */
export function ConfigureStepShell({
  children,
  onBack,
  onNext,
  showNext,
  onExecute,
  executeDisabled,
  executeLoading,
  isDarkMode,
  onToggleDark,
  onReset,
}: ConfigureStepShellProps) {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute right-[-5%] top-[-10%] h-[40vw] w-[40vw] rounded-full bg-[#2563eb]/10 blur-[120px]"
          aria-hidden
        />
        <div
          className="absolute bottom-[-10%] left-[-5%] h-[30vw] w-[30vw] rounded-full bg-[#571bc1]/10 blur-[100px]"
          aria-hidden
        />
      </div>

      <header className="chrome-panel fixed top-0 z-50 flex h-16 w-full items-center justify-between gap-3 border-x-0 border-t-0 px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <span className="truncate font-jakarta text-base font-bold tracking-tight sm:text-lg">
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent dark:from-[#2563eb] dark:to-[#d0bcff]">
              Assistente de Cruzamento
            </span>
          </span>
        </div>

        <div className="hidden md:block">
          <StepIndicator currentStep="configure" />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <UiPreferencesMenu />
          <button
            type="button"
            className="rounded-full p-2 text-zinc-600 transition-all hover:bg-black/5 hover:text-zinc-900 dark:text-[#c3c6d7] dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Ajuda"
            title="Carregue duas bases, defina chaves e colunas a trazer; depois execute o cruzamento."
          >
            <HelpCircle size={20} />
          </button>
          <button
            type="button"
            onClick={onToggleDark}
            className="rounded-full p-2 text-zinc-600 transition-all hover:bg-black/5 hover:text-zinc-900 dark:text-[#c3c6d7] dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={isDarkMode ? 'Tema claro' : 'Tema escuro'}
            title={isDarkMode ? 'Tema claro' : 'Tema escuro'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full p-2 text-zinc-600 transition-all hover:bg-black/5 hover:text-zinc-900 dark:text-[#c3c6d7] dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Reiniciar"
            title="Reiniciar"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </header>

      <div className="fixed inset-x-0 top-16 z-40 flex justify-center border-b border-black/[0.06] bg-white/70 px-2 py-2 backdrop-blur-2xl dark:border-white/10 dark:bg-[#1c1b1b]/60 md:hidden">
        <StepIndicator currentStep="configure" compact />
      </div>

      {children}

      <footer className="chrome-panel fixed bottom-0 z-50 w-full border-x-0 border-b-0 px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <motion.button
            type="button"
            onClick={onBack}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 py-3 font-medium text-zinc-700 transition-all hover:bg-black/5 sm:justify-start sm:px-8 dark:text-[#e5e2e1] dark:hover:bg-white/5"
          >
            <ArrowLeft size={18} />
            Voltar
          </motion.button>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {showNext && (
              <motion.button
                type="button"
                onClick={onNext}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                className="min-h-[44px] rounded-full border border-black/10 px-6 py-3 font-medium text-zinc-700 transition-all hover:bg-black/5 sm:px-8 dark:border-white/10 dark:text-[#e5e2e1] dark:hover:bg-white/5"
              >
                Próximo
              </motion.button>
            )}
            <motion.button
              type="button"
              disabled={executeDisabled}
              onClick={onExecute}
              whileHover={executeDisabled ? undefined : { scale: 1.01 }}
              whileTap={executeDisabled ? undefined : { scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className={cn(
                'flex min-h-[44px] items-center justify-center gap-2 rounded-full px-8 py-4 font-bold text-white shadow-[0_10px_25px_rgba(37,99,235,0.35)] transition-all sm:px-10',
                executeDisabled
                  ? 'cursor-not-allowed bg-zinc-500 opacity-50 shadow-none dark:bg-zinc-600'
                  : 'bg-gradient-to-r from-[#2563eb] via-[#4f46e5] to-[#571bc1]'
              )}
            >
              {executeLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processando…
                </>
              ) : (
                <>
                  <Rocket size={18} />
                  Executar Cruzamento
                </>
              )}
            </motion.button>
          </div>
        </div>
      </footer>
    </>
  );
}
