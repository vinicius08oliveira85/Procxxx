import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  HelpCircle,
  Moon,
  RotateCcw,
  Rocket,
  SlidersHorizontal,
  Sun,
  User,
} from 'lucide-react';
import { cn } from '../lib/utils';

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
  onGoUpload: () => void;
  onNavTables: () => void;
  onNavMapping: () => void;
}

/**
 * Layout full-page da etapa Configurar: header fixo, stepper e footer estilo mockup.
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
  onGoUpload,
  onNavTables,
  onNavMapping,
}: ConfigureStepShellProps) {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute right-[-5%] top-[-10%] h-[40vw] w-[40vw] rounded-full bg-[#2563eb]/12 blur-[120px]"
          aria-hidden
        />
        <div
          className="absolute bottom-[-10%] left-[-5%] h-[30vw] w-[30vw] rounded-full bg-[#571bc1]/12 blur-[100px]"
          aria-hidden
        />
      </div>

      <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/10 bg-[#1c1b1b]/55 px-4 backdrop-blur-2xl sm:px-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <span className="truncate font-jakarta text-lg font-bold tracking-tight text-white sm:text-xl">
            <span className="bg-gradient-to-r from-[#2563eb] to-[#d0bcff] bg-clip-text text-transparent">
              Assistente de Cruzamento
            </span>
          </span>
          <nav className="ml-2 hidden items-center gap-6 md:flex">
            <motion.button
              type="button"
              onClick={onGoUpload}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 transition-colors hover:text-white"
            >
              Visão Geral
            </motion.button>
            <motion.button
              type="button"
              onClick={onNavTables}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="border-b-2 border-[#2563eb] pb-1 text-[10px] font-medium uppercase tracking-widest text-[#b4c5ff]"
            >
              Tabelas
            </motion.button>
            <motion.button
              type="button"
              onClick={onNavMapping}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 transition-colors hover:text-white"
            >
              Mapeamento
            </motion.button>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            className="rounded-full p-2 text-[#c3c6d7] transition-all hover:bg-white/5"
            aria-label="Ajuda"
            title="Carregue duas bases, defina chaves e colunas a trazer; depois execute o cruzamento."
          >
            <HelpCircle size={20} />
          </button>
          <button
            type="button"
            onClick={onToggleDark}
            className="rounded-full p-2 text-[#c3c6d7] transition-all hover:bg-white/5"
            aria-label={isDarkMode ? 'Tema claro' : 'Tema escuro'}
            title={isDarkMode ? 'Tema claro' : 'Tema escuro'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full p-2 text-[#c3c6d7] transition-all hover:bg-white/5"
            aria-label="Reiniciar"
            title="Reiniciar"
          >
            <RotateCcw size={20} />
          </button>
          <div className="hidden h-8 w-8 overflow-hidden rounded-full border border-[#434655]/30 bg-[#353534] sm:flex sm:items-center sm:justify-center">
            <User size={16} className="text-[#c3c6d7]" aria-hidden />
          </div>
        </div>
      </header>

      {children}

      <footer className="fixed bottom-0 z-50 w-full border-t border-white/10 bg-[#131313]/50 px-4 py-5 backdrop-blur-2xl sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <motion.button
            type="button"
            onClick={onBack}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 py-3 font-medium text-[#e5e2e1] transition-all hover:bg-white/5 sm:justify-start sm:px-8"
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
                className="min-h-[44px] rounded-full border border-white/10 px-6 py-3 font-medium text-[#e5e2e1] transition-all hover:bg-white/5 sm:px-8"
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
                  ? 'cursor-not-allowed bg-zinc-600 opacity-50 shadow-none'
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

/** Stepper circular do mockup (passo 2 ativo). */
export function ConfigureWizardStepper() {
  return (
    <div className="mb-4 flex w-full max-w-2xl items-center justify-between">
      <div className="flex flex-col items-center gap-2 opacity-60">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#434655]/20 bg-[#2a2a2a]">
          <Check className="h-4 w-4 text-[#e5e2e1]" strokeWidth={2.5} />
        </div>
        <span className="font-jakarta text-[10px] font-medium uppercase tracking-widest text-zinc-400">
          1. Upload
        </span>
      </div>
      <div className="mx-4 h-px flex-1 bg-[#434655]/20" />
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-[#2563eb] to-[#571bc1] shadow-[0_0_20px_rgba(37,99,235,0.35)]"
          aria-current="step"
        >
          <SlidersHorizontal className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
        <span className="font-jakarta text-[10px] font-bold uppercase tracking-widest text-[#b4c5ff]">
          2. Configurar
        </span>
      </div>
      <div className="mx-4 h-px flex-1 bg-[#434655]/20" />
      <div className="flex flex-col items-center gap-2 opacity-40">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#434655]/20 bg-[#2a2a2a]">
          <BarChart3 className="h-4 w-4 text-[#e5e2e1]" strokeWidth={2} />
        </div>
        <span className="font-jakarta text-[10px] font-medium uppercase tracking-widest text-zinc-400">
          3. Resultado
        </span>
      </div>
    </div>
  );
}
