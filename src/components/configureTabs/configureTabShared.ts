import type { LookupTask } from '../../types/lookupTask';

/** Classe Tailwind reutilizada nos selects da aba Conexão (tema claro/escuro). */
export const selectDarkClass =
  'w-full rounded-xl border border-black/10 bg-white/70 py-2.5 px-3 text-sm text-zinc-900 outline-none backdrop-blur-xl focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 dark:border-white/10 dark:bg-[#0e0e0e]/90 dark:text-[#e5e2e1] dark:focus:border-[#b4c5ff]/40 dark:focus:ring-[#b4c5ff]/20';

export interface ConfigureKeyMetrics {
  totalRows: number;
  dupInB: number;
  matchApprox: number | null;
  valueFormat: string;
}

export type ConfigureTaskPatch = Partial<LookupTask>;
