import React from 'react';
import { motion } from 'motion/react';
import { Target, Link2 } from 'lucide-react';
import type { LookupTask } from '../../types/lookupTask';
import { selectDarkClass, type ConfigureKeyMetrics, type ConfigureTaskPatch } from './configureTabShared';

export interface ConfigureKeysTabProps {
  activeTask: LookupTask;
  onTaskPatch: (patch: ConfigureTaskPatch) => void;
  headersA: string[];
  headersB: string[];
  headersC: string[];
  metrics: ConfigureKeyMetrics;
}

export function ConfigureKeysTab({
  activeTask,
  onTaskPatch,
  headersA,
  headersB,
  headersC,
  metrics,
}: ConfigureKeysTabProps) {
  return (
    <motion.div
      key="keys"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div>
        <h3 className="font-jakarta text-lg font-bold tracking-tight text-[#e5e2e1]">Mapeamento de chaves</h3>
        <p className="mt-1 text-xs text-zinc-400">
          Escolha a coluna que liga a tabela principal à tabela de busca (ex.: CPF, código, e-mail).
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Coluna na tabela principal
          </label>
          <select
            value={activeTask.keyA}
            onChange={(e) => onTaskPatch({ keyA: e.target.value })}
            className={selectDarkClass}
          >
            <option value="">Selecione…</option>
            {headersA.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="flex shrink-0 items-center justify-center md:pb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#434655]/30 bg-[#141414] text-[#b4c5ff]">
            <Link2 className="h-5 w-5" aria-hidden />
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Coluna na tabela de busca
          </label>
          <select
            value={activeTask.keyB}
            onChange={(e) => onTaskPatch({ keyB: e.target.value })}
            className={selectDarkClass}
          >
            <option value="">Selecione…</option>
            {headersB.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Linhas (principal)', value: metrics.totalRows.toLocaleString('pt-BR') },
          { label: 'Duplicatas na chave (B)', value: metrics.dupInB.toLocaleString('pt-BR') },
          {
            label: 'Match estimado (amostra)',
            value: metrics.matchApprox !== null ? `${metrics.matchApprox}%` : '—',
          },
          { label: 'Formato da chave (A)', value: metrics.valueFormat },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-white/10 bg-[#141414]/60 px-3 py-3 backdrop-blur-2xl"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{m.label}</p>
            <p className="mt-1 font-jakarta text-lg font-bold text-[#e5e2e1]">{m.value}</p>
          </div>
        ))}
      </div>

      {activeTask.fileC && (
        <div className="rounded-xl border border-white/10 bg-[#141414]/45 p-4 backdrop-blur-2xl">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#e5e2e1]">Tabela extra (C)</h4>
              <p className="text-xs text-zinc-400">Segunda busca opcional ligada à principal.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Coluna na principal (para C)
              </label>
              <select
                value={activeTask.keyA_C}
                onChange={(e) => onTaskPatch({ keyA_C: e.target.value })}
                className={selectDarkClass}
              >
                <option value="">Selecione…</option>
                {headersA.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Coluna na tabela extra
              </label>
              <select
                value={activeTask.keyC}
                onChange={(e) => onTaskPatch({ keyC: e.target.value })}
                className={selectDarkClass}
              >
                <option value="">Selecione…</option>
                {headersC.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
