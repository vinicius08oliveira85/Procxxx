import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Columns, Search, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LookupTask } from '../../types/lookupTask';
import type { ConfigureTaskPatch } from './configureTabShared';

export interface ConfigureColumnsTabProps {
  activeTask: LookupTask;
  onTaskPatch: (patch: ConfigureTaskPatch) => void;
  headersA: string[];
  headersB: string[];
  headersC: string[];
}

export function ConfigureColumnsTab({
  activeTask,
  onTaskPatch,
  headersA,
  headersB,
  headersC,
}: ConfigureColumnsTabProps) {
  const [searchTermA, setSearchTermA] = useState('');
  const [searchTermB, setSearchTermB] = useState('');
  const [searchTermC, setSearchTermC] = useState('');

  return (
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
  );
}
