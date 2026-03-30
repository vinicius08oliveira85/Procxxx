/**
 * Painéis das abas Conexão / Colunas / Opções extras na etapa Configurar.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Target,
  Columns,
  Settings2,
  Search,
  CheckCircle2,
  Info,
  AlertCircle,
  Zap,
  Layers,
  Activity,
  HelpCircle,
  ArrowUpDown,
  Link2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { LookupTask } from '../App';

export type ConfigTabId = 'keys' | 'columns' | 'advanced';

const selectDark =
  'w-full rounded-xl border border-[#434655]/25 bg-[#0e0e0e] py-2.5 px-3 text-sm text-[#e5e2e1] outline-none focus:border-[#b4c5ff]/40 focus:ring-1 focus:ring-[#b4c5ff]/20';

interface KeyMetrics {
  totalRows: number;
  dupInB: number;
  matchApprox: number | null;
  valueFormat: string;
}

interface ConfigureTabPanelsProps {
  configTab: ConfigTabId;
  activeTask: LookupTask;
  onTaskPatch: (patch: Partial<LookupTask>) => void;
  headersA: string[];
  headersB: string[];
  headersC: string[];
  metrics: KeyMetrics;
}

export function ConfigureTabPanels({
  configTab,
  activeTask,
  onTaskPatch,
  headersA,
  headersB,
  headersC,
  metrics,
}: ConfigureTabPanelsProps) {
  const [searchTermA, setSearchTermA] = useState('');
  const [searchTermB, setSearchTermB] = useState('');
  const [searchTermC, setSearchTermC] = useState('');

  return (
    <AnimatePresence mode="wait">
      {configTab === 'keys' && (
        <motion.div
          key="keys"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          <div>
            <h3 className="font-jakarta text-lg font-bold text-[#e5e2e1]">Mapeamento de chaves</h3>
            <p className="mt-1 text-xs text-[#8d90a0]">
              Escolha a coluna que liga a tabela principal à tabela de busca (ex.: CPF, código, e-mail).
            </p>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#8d90a0]">
                Coluna na tabela principal
              </label>
              <select
                value={activeTask.keyA}
                onChange={(e) => onTaskPatch({ keyA: e.target.value })}
                className={selectDark}
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#8d90a0]">
                Coluna na tabela de busca
              </label>
              <select
                value={activeTask.keyB}
                onChange={(e) => onTaskPatch({ keyB: e.target.value })}
                className={selectDark}
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
              {
                label: 'Duplicatas na chave (B)',
                value: metrics.dupInB.toLocaleString('pt-BR'),
              },
              {
                label: 'Match estimado (amostra)',
                value:
                  metrics.matchApprox !== null ? `${metrics.matchApprox}%` : '—',
              },
              { label: 'Formato da chave (A)', value: metrics.valueFormat },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-[#434655]/15 bg-[#141414]/90 px-3 py-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8d90a0]">
                  {m.label}
                </p>
                <p className="mt-1 font-jakarta text-lg font-bold text-[#e5e2e1]">{m.value}</p>
              </div>
            ))}
          </div>

          {activeTask.fileC && (
            <div className="rounded-xl border border-[#434655]/15 bg-[#141414]/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#e5e2e1]">Tabela extra (C)</h4>
                  <p className="text-xs text-[#8d90a0]">Segunda busca opcional ligada à principal.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8d90a0]">
                    Coluna na principal (para C)
                  </label>
                  <select
                    value={activeTask.keyA_C}
                    onChange={(e) => onTaskPatch({ keyA_C: e.target.value })}
                    className={selectDark}
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
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8d90a0]">
                    Coluna na tabela extra
                  </label>
                  <select
                    value={activeTask.keyC}
                    onChange={(e) => onTaskPatch({ keyC: e.target.value })}
                    className={selectDark}
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
      )}

      {configTab === 'columns' && (
        <motion.div
          key="columns"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="space-y-3"
        >
          <div className="fluent-card p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black flex items-center gap-1.5">
                  <Columns size={14} className="text-zinc-400" /> Colunas originais (tabela principal)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-zinc-500/20 text-zinc-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  {activeTask.selectedColsA.length === 0
                    ? 'Todas'
                    : `${activeTask.selectedColsA.length} selecionadas`}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Filtrar nomes de colunas..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl dark:border-white/10 border-black/10 border dark:bg-black/20 bg-white/60 focus:border-blue-500 outline-none text-xs dark:text-zinc-300 text-zinc-700 font-medium"
                  value={searchTermA}
                  onChange={(e) => setSearchTermA(e.target.value.toLowerCase())}
                />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onTaskPatch({ selectedColsA: headersA })}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                >
                  Selecionar tudo
                </button>
                <button
                  type="button"
                  onClick={() => onTaskPatch({ selectedColsA: [] })}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                >
                  Todas (padrão)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[min(13.75rem,42dvh)] sm:max-h-[min(17rem,48dvh)] lg:max-h-[min(22rem,55dvh)] overflow-y-auto pr-1 custom-scrollbar">
              {headersA
                .filter((h) => h.toLowerCase().includes(searchTermA))
                .map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      onTaskPatch({
                        selectedColsA: activeTask.selectedColsA.includes(h)
                          ? activeTask.selectedColsA.filter((c) => c !== h)
                          : [...activeTask.selectedColsA, h],
                      });
                    }}
                    className={cn(
                      'p-2.5 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center justify-between group relative overflow-hidden',
                      activeTask.selectedColsA.includes(h)
                        ? 'border-zinc-500/50 bg-zinc-500/10 text-zinc-300 shadow-sm'
                        : 'dark:border-white/5 dark:bg-black/20 dark:hover:border-white/20 dark:hover:bg-white/5 border-black/10 bg-white/60 hover:border-black/20 hover:bg-black/5'
                    )}
                  >
                    <span className="truncate z-10">{h}</span>
                    {activeTask.selectedColsA.includes(h) ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="z-10">
                        <CheckCircle2 size={16} className="text-zinc-400" />
                      </motion.div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border dark:border-white/10 border-black/10 group-hover:border-zinc-400" />
                    )}
                  </button>
                ))}
            </div>

            {activeTask.selectedColsA.length === 0 && (
              <p className="text-[10px] text-zinc-500 italic">
                Se não selecionar nada, todas as colunas originais serão mantidas.
              </p>
            )}
          </div>

          <div className="fluent-card p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black flex items-center gap-1.5">
                  <Columns size={14} className="text-blue-600" /> Colunas para importar (tabela de busca)
                  <div className="group relative">
                    <Info size={13} className="text-zinc-500 cursor-help" />
                    <div className="absolute bottom-full left-0 mb-2 w-64 p-3 dark:bg-zinc-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10 font-normal">
                      <p className="font-bold mb-1">O que trazer?</p>
                      <p className="opacity-80">
                        Marque as colunas com as informações que você quer copiar para a tabela principal.
                      </p>
                    </div>
                  </div>
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  {activeTask.selectedColsB.length} selecionadas
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Filtrar nomes de colunas..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border dark:border-white/10 border-black/10 dark:bg-black/20 bg-white/60 focus:border-blue-500 outline-none text-xs dark:text-zinc-300 text-zinc-700 font-medium"
                  value={searchTermB}
                  onChange={(e) => setSearchTermB(e.target.value.toLowerCase())}
                />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onTaskPatch({ selectedColsB: headersB })}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-blue-400 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                >
                  Selecionar tudo
                </button>
                <button
                  type="button"
                  onClick={() => onTaskPatch({ selectedColsB: [] })}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[min(13.75rem,42dvh)] sm:max-h-[min(17rem,48dvh)] lg:max-h-[min(22rem,55dvh)] overflow-y-auto pr-1 custom-scrollbar">
              {headersB
                .filter((h) => h.toLowerCase().includes(searchTermB))
                .map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      onTaskPatch({
                        selectedColsB: activeTask.selectedColsB.includes(h)
                          ? activeTask.selectedColsB.filter((c) => c !== h)
                          : [...activeTask.selectedColsB, h],
                      });
                    }}
                    className={cn(
                      'p-2.5 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center justify-between group relative overflow-hidden',
                      activeTask.selectedColsB.includes(h)
                        ? activeTask.lookupType === 'vlookup' &&
                          headersB.indexOf(h) < headersB.indexOf(activeTask.keyB)
                          ? 'border-red-500/50 bg-red-500/10 text-red-400 shadow-sm'
                          : 'border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-sm'
                        : 'dark:border-white/5 dark:bg-black/20 dark:hover:border-white/20 dark:hover:bg-white/5 border-black/10 bg-white/60 hover:border-black/20 hover:bg-black/5'
                    )}
                  >
                    <span className="truncate z-10">{h}</span>
                    {activeTask.selectedColsB.includes(h) ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="z-10">
                        {activeTask.lookupType === 'vlookup' &&
                        headersB.indexOf(h) < headersB.indexOf(activeTask.keyB) ? (
                          <AlertCircle size={16} className="text-red-400" />
                        ) : (
                          <CheckCircle2 size={16} className="text-blue-400" />
                        )}
                      </motion.div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border dark:border-white/10 border-black/10 group-hover:border-blue-400" />
                    )}
                  </button>
                ))}
            </div>
          </div>

          {activeTask.fileC && (
            <div className="fluent-card p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black flex items-center gap-1.5">
                    <Columns size={14} className="text-purple-400" /> Colunas para importar (tabela extra)
                    <div className="group relative">
                      <Info size={13} className="text-zinc-500 cursor-help" />
                      <div className="absolute bottom-full left-0 mb-2 w-64 p-3 dark:bg-zinc-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10 font-normal">
                        <p className="font-bold mb-1">O que trazer?</p>
                        <p className="opacity-80">Marque as colunas que você quer copiar desta tabela extra.</p>
                      </div>
                    </div>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-purple-600/20 text-purple-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                    {activeTask.selectedColsC.length} selecionadas
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" />
                  <input
                    type="text"
                    placeholder="Filtrar colunas da tabela C..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border dark:border-white/10 border-black/10 dark:bg-black/20 bg-white/60 focus:border-blue-500 outline-none text-xs dark:text-zinc-300 text-zinc-700 font-medium"
                    value={searchTermC}
                    onChange={(e) => setSearchTermC(e.target.value.toLowerCase())}
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onTaskPatch({ selectedColsC: headersC })}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-purple-400 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                  >
                    Selecionar tudo
                  </button>
                  <button
                    type="button"
                    onClick={() => onTaskPatch({ selectedColsC: [] })}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-zinc-500 dark:hover:bg-white/5 hover:bg-black/5 transition-all border dark:border-white/5 border-black/10"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[min(13.75rem,42dvh)] sm:max-h-[min(17rem,48dvh)] lg:max-h-[min(22rem,55dvh)] overflow-y-auto pr-1 custom-scrollbar">
                {headersC
                  .filter((h) => h.toLowerCase().includes(searchTermC))
                  .map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        onTaskPatch({
                          selectedColsC: activeTask.selectedColsC.includes(h)
                            ? activeTask.selectedColsC.filter((c) => c !== h)
                            : [...activeTask.selectedColsC, h],
                        });
                      }}
                      className={cn(
                        'p-2.5 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center justify-between group relative overflow-hidden',
                        activeTask.selectedColsC.includes(h)
                          ? activeTask.lookupType === 'vlookup' &&
                            headersC.indexOf(h) < headersC.indexOf(activeTask.keyC)
                            ? 'border-red-500/50 bg-red-500/10 text-red-400 shadow-sm'
                            : 'border-purple-500/50 bg-purple-500/10 text-purple-400 shadow-sm'
                          : 'dark:border-white/5 dark:bg-black/20 dark:hover:border-white/20 dark:hover:bg-white/5 border-black/10 bg-white/60 hover:border-black/20 hover:bg-black/5'
                      )}
                    >
                      <span className="truncate z-10">{h}</span>
                      {activeTask.selectedColsC.includes(h) ? (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="z-10">
                          {activeTask.lookupType === 'vlookup' &&
                          headersC.indexOf(h) < headersC.indexOf(activeTask.keyC) ? (
                            <AlertCircle size={16} className="text-red-400" />
                          ) : (
                            <CheckCircle2 size={16} className="text-purple-400" />
                          )}
                        </motion.div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border dark:border-white/10 border-black/10 group-hover:border-purple-400" />
                      )}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {configTab === 'advanced' && (
        <motion.div
          key="advanced"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="fluent-card p-3 sm:p-4 space-y-3"
        >
          <div>
            <h2 className="text-sm font-black flex items-center gap-2">
              <Settings2 size={14} className="text-blue-600" /> Ajustes finos
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-2 p-3 dark:bg-white/5 bg-black/5 rounded-2xl border dark:border-white/5 border-black/10">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <Zap size={12} className="text-blue-400" /> Padronização
                </h3>
                <div className="group relative">
                  <Info size={11} className="text-zinc-500 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-zinc-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                    <p className="font-bold mb-1">Evitar erros comuns</p>
                    <p className="opacity-80">
                      Ajuda a encontrar correspondências mesmo que o texto não esteja idêntico (ex.: &quot;JOSÉ&quot; e
                      &quot;jose&quot;).
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {(
                  [
                    {
                      id: 'trimSpaces',
                      label: 'Remover espaços extras',
                      field: 'trimSpaces' as const,
                      help: 'Remove espaços no início e fim do texto.',
                    },
                    {
                      id: 'ignoreCase',
                      label: 'Ignorar maiúsculas/minúsculas',
                      field: 'ignoreCase' as const,
                      help: 'Trata &quot;TEXTO&quot; e &quot;texto&quot; como iguais.',
                    },
                    {
                      id: 'removeSpecialChars',
                      label: 'Remover caracteres especiais',
                      field: 'removeSpecialChars' as const,
                      help: 'Remove acentos e símbolos (ex.: &quot;ç&quot; vira &quot;c&quot;).',
                    },
                  ] as const
                ).map((opt) => (
                  <div key={opt.id} className="flex items-center justify-between group/item">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={activeTask[opt.field]}
                          onChange={(e) => onTaskPatch({ [opt.field]: e.target.checked })}
                          className="peer sr-only"
                        />
                        <div className="w-8 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-blue-600 transition-colors" />
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-3" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                        {opt.label}
                      </span>
                    </label>
                    <div className="group relative">
                      <Info size={10} className="text-slate-300 dark:text-slate-600 cursor-help" />
                      <div className="absolute bottom-full right-0 mb-2 w-48 p-2 dark:bg-slate-800 bg-white dark:text-white text-zinc-800 text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-lg border dark:border-white/10 border-black/10">
                        {opt.help}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Layers size={12} className="text-blue-500" /> Se houver repetidos
                </h3>
                <div className="group relative">
                  <Info size={11} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                    <p className="font-bold mb-1">Duplicatas na busca</p>
                    <p className="opacity-80">
                      Se o código procurado aparecer mais de uma vez na tabela de busca, qual registro usar?
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <select
                  value={activeTask.duplicateStrategy}
                  onChange={(e) =>
                    onTaskPatch({
                      duplicateStrategy: e.target.value as LookupTask['duplicateStrategy'],
                    })
                  }
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                >
                  <option value="first">Usar o primeiro encontrado</option>
                  <option value="last">Usar o último encontrado</option>
                  <option value="concatenate">Juntar todos (separar por ;)</option>
                </select>
                <p className="text-[10px] text-slate-400 italic leading-relaxed">
                  {activeTask.duplicateStrategy === 'first' && 'Retorna apenas a primeira ocorrência encontrada.'}
                  {activeTask.duplicateStrategy === 'last' && 'Retorna apenas a última ocorrência encontrada.'}
                  {activeTask.duplicateStrategy === 'concatenate' &&
                    'Junta todos os valores encontrados separados por ponto e vírgula.'}
                </p>
              </div>
            </div>

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Target size={12} className="text-blue-500" /> Modo de busca
                </h3>
                <div className="group relative">
                  <Info size={11} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                    <p className="font-bold mb-1">Como comparar?</p>
                    <p className="opacity-80">
                      Define se o valor precisa ser idêntico ou se pode buscar valores próximos (útil para faixas).
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <select
                  value={activeTask.matchMode}
                  onChange={(e) =>
                    onTaskPatch({ matchMode: Number(e.target.value) as LookupTask['matchMode'] })
                  }
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                  disabled={!activeTask.exactMatch}
                >
                  <option value="0">Correspondência exata (padrão)</option>
                  <option value="-1">Aproximada (menor valor próximo)</option>
                  <option value="1">Aproximada (maior valor próximo)</option>
                  <option value="2">Usar curingas (* e ?)</option>
                </select>
                <p className="text-[10px] text-slate-400 italic leading-relaxed">
                  {!activeTask.exactMatch
                    ? 'Desativado em modo fuzzy.'
                    : activeTask.matchMode === 0
                      ? 'Busca apenas o valor idêntico.'
                      : activeTask.matchMode === -1
                        ? 'Se não encontrar, pega o valor imediatamente inferior.'
                        : activeTask.matchMode === 1
                          ? 'Se não encontrar, pega o valor imediatamente superior.'
                          : "Permite usar '*' para vários caracteres e '?' para um único."}
                </p>
              </div>
            </div>

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Activity size={12} className="text-blue-500" /> Corretor de digitação (
                  {Math.round(activeTask.fuzzyThreshold * 100)}%)
                </h3>
                <div className="group relative">
                  <Info size={11} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                    <p className="font-bold mb-1">Tolerância a erros</p>
                    <p className="opacity-80">
                      Útil quando os nomes podem estar digitados errado. Quanto menor a porcentagem, mais diferenças
                      aceita.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={activeTask.fuzzyThreshold}
                  onChange={(e) => onTaskPatch({ fuzzyThreshold: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-black">
                  <span>Mais flexível</span>
                  <span>Mais rígido</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 sm:col-span-2 md:col-span-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-blue-500" /> Colunas de verificação
                </h3>
                <div className="group relative">
                  <Info size={11} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                    <p className="font-bold mb-1">Achou ou não?</p>
                    <p className="opacity-80">
                      Cria colunas no final com VERDADEIRO se encontrou o valor ou FALSO se não encontrou.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onTaskPatch({ includeStatusCols: !activeTask.includeStatusCols })}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0',
                    activeTask.includeStatusCols ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                      activeTask.includeStatusCols ? 'translate-x-[18px]' : 'translate-x-0.5'
                    )}
                  />
                </button>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Criar colunas que indicam se houve correspondência (VERDADEIRO/FALSO)
                </span>
              </div>
            </div>

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 sm:col-span-2 md:col-span-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <HelpCircle size={12} className="text-blue-500" /> Valor se não encontrar
                </h3>
                <div className="group relative">
                  <Info size={11} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                    <p className="font-bold mb-1">Texto padrão</p>
                    <p className="opacity-80">
                      Quando não houver correspondência, este texto preenche a célula (ex.: #N/D, Não encontrado).
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Para tabela B</label>
                  <input
                    type="text"
                    value={activeTask.ifNotFound}
                    onChange={(e) => onTaskPatch({ ifNotFound: e.target.value })}
                    placeholder="#N/D"
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
                {activeTask.fileC && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Para tabela C</label>
                    <input
                      type="text"
                      value={activeTask.ifNotFoundC}
                      onChange={(e) => onTaskPatch({ ifNotFoundC: e.target.value })}
                      placeholder="#N/D"
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 sm:col-span-2 md:col-span-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <ArrowUpDown size={12} className="text-blue-500" /> Ordem da busca
                </h3>
                <div className="group relative">
                  <Info size={11} className="text-slate-400 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 dark:bg-slate-900 bg-white dark:text-white text-zinc-800 text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity delay-300 pointer-events-none z-50 shadow-xl border dark:border-white/10 border-black/10">
                    <p className="font-bold mb-1">De cima ou de baixo?</p>
                    <p className="opacity-80">Define se a busca começa do início da tabela (padrão) ou do fim.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <select
                  value={activeTask.searchDirection}
                  onChange={(e) =>
                    onTaskPatch({
                      searchDirection: Number(e.target.value) as LookupTask['searchDirection'],
                    })
                  }
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-none focus:border-blue-500"
                >
                  <option value="1">Do primeiro ao último (padrão)</option>
                  <option value="-1">Do último ao primeiro</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
