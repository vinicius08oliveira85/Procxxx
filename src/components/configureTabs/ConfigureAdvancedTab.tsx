import React from 'react';
import { motion } from 'motion/react';
import {
  Settings2,
  Info,
  Zap,
  Layers,
  Target,
  Activity,
  CheckCircle2,
  HelpCircle,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { LookupTask } from '../../types/lookupTask';
import type { ConfigureTaskPatch } from './configureTabShared';

export interface ConfigureAdvancedTabProps {
  activeTask: LookupTask;
  onTaskPatch: (patch: ConfigureTaskPatch) => void;
}

export function ConfigureAdvancedTab({ activeTask, onTaskPatch }: ConfigureAdvancedTabProps) {
  return (
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
                  Útil quando os nomes podem estar digitados errado. Quanto menor a porcentagem, mais diferenças aceita.
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
  );
}
