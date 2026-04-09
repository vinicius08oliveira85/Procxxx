import type { LookupTask } from '../../types/lookupTask';

/** Classe Tailwind reutilizada nos selects da aba Conexão (tema escuro do shell). */
export const selectDarkClass =
  'w-full rounded-xl border border-white/10 bg-[#0e0e0e]/90 py-2.5 px-3 text-sm text-[#e5e2e1] outline-none backdrop-blur-xl focus:border-[#b4c5ff]/40 focus:ring-1 focus:ring-[#b4c5ff]/20';

export interface ConfigureKeyMetrics {
  totalRows: number;
  dupInB: number;
  matchApprox: number | null;
  valueFormat: string;
}

export type ConfigureTaskPatch = Partial<LookupTask>;
