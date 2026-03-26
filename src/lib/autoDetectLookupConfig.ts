/**
 * Heurística local (mesma lógica do botão "Tentar Configuração Automática" no App).
 * Sem efeitos colaterais — útil para comparar com a sugestão da IA.
 */

const COMMON_KEYS = [
  'id',
  'cpf',
  'cnpj',
  'email',
  'e-mail',
  'codigo',
  'código',
  'sku',
  'nome',
  'name',
] as const;

export type AutoDetectLookupResult = {
  keyA: string;
  keyB: string;
  selectedColsB: string[];
};

export function computeAutoDetectLookup(headersA: string[], headersB: string[]): AutoDetectLookupResult {
  const out: AutoDetectLookupResult = { keyA: '', keyB: '', selectedColsB: [] };
  if (!headersA.length || !headersB.length) return out;

  let bestKeyA = '';
  let bestKeyB = '';

  for (const hA of headersA) {
    const normalizedA = hA.toLowerCase().trim();
    if (headersB.some(hB => hB.toLowerCase().trim() === normalizedA)) {
      bestKeyA = hA;
      bestKeyB = headersB.find(hB => hB.toLowerCase().trim() === normalizedA) || '';
      break;
    }
  }

  if (!bestKeyA) {
    for (const key of COMMON_KEYS) {
      const foundA = headersA.find(h => h.toLowerCase().includes(key));
      const foundB = headersB.find(h => h.toLowerCase().includes(key));
      if (foundA && foundB) {
        bestKeyA = foundA;
        bestKeyB = foundB;
        break;
      }
    }
  }

  out.keyA = bestKeyA;
  out.keyB = bestKeyB;

  const suggestedCols = headersB.filter(
    hB => hB !== bestKeyB && !headersA.some(hA => hA.toLowerCase().trim() === hB.toLowerCase().trim())
  );

  if (suggestedCols.length > 0) {
    out.selectedColsB = suggestedCols;
  } else if (headersB.length > 1) {
    const firstOther = headersB.find(h => h !== bestKeyB);
    if (firstOther) out.selectedColsB = [firstOther];
  }

  return out;
}
