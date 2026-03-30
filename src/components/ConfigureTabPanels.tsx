/**
 * Orquestra as abas Conexão / Colunas / Opções extras na etapa Configurar.
 */
import React from 'react';
import { AnimatePresence } from 'motion/react';
import type { LookupTask } from '../types/lookupTask';
import type { ConfigureKeyMetrics } from './configureTabs/configureTabShared';
import { ConfigureKeysTab } from './configureTabs/ConfigureKeysTab';
import { ConfigureColumnsTab } from './configureTabs/ConfigureColumnsTab';
import { ConfigureAdvancedTab } from './configureTabs/ConfigureAdvancedTab';

export type ConfigTabId = 'keys' | 'columns' | 'advanced';

interface ConfigureTabPanelsProps {
  configTab: ConfigTabId;
  activeTask: LookupTask;
  onTaskPatch: (patch: Partial<LookupTask>) => void;
  headersA: string[];
  headersB: string[];
  headersC: string[];
  metrics: ConfigureKeyMetrics;
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
  return (
    <AnimatePresence mode="wait">
      {configTab === 'keys' && (
        <ConfigureKeysTab
          activeTask={activeTask}
          onTaskPatch={onTaskPatch}
          headersA={headersA}
          headersB={headersB}
          headersC={headersC}
          metrics={metrics}
        />
      )}
      {configTab === 'columns' && (
        <ConfigureColumnsTab
          activeTask={activeTask}
          onTaskPatch={onTaskPatch}
          headersA={headersA}
          headersB={headersB}
          headersC={headersC}
        />
      )}
      {configTab === 'advanced' && (
        <ConfigureAdvancedTab activeTask={activeTask} onTaskPatch={onTaskPatch} />
      )}
    </AnimatePresence>
  );
}
