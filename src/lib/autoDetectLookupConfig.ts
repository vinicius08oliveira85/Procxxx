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

function normHeader(header: string): string {
  return header.toLowerCase().trim();
}

/**
 * `true` quando a chave aparece como palavra inteira no cabeçalho.
 * Evita que `id` case com "Cidade" ou "Identificador" no meio de outra palavra.
 */
function headerContainsKey(header: string, key: string): boolean {
  const h = normHeader(header);
  if (!h) return false;
  if (h === key) return true;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(h);
}

export function computeAutoDetectLookup(headersA: string[], headersB: string[]): AutoDetectLookupResult {
  const out: AutoDetectLookupResult = { keyA: '', keyB: '', selectedColsB: [] };
  if (!headersA.length || !headersB.length) return out;

  let bestKeyA = '';
  let bestKeyB = '';

  for (const hA of headersA) {
    const normalizedA = normHeader(hA);
    if (headersB.some(hB => normHeader(hB) === normalizedA)) {
      bestKeyA = hA;
      bestKeyB = headersB.find(hB => normHeader(hB) === normalizedA) || '';
      break;
    }
  }

  if (!bestKeyA) {
    for (const key of COMMON_KEYS) {
      const foundA = headersA.find(h => headerContainsKey(h, key));
      const foundB = headersB.find(h => headerContainsKey(h, key));
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
    hB => hB !== bestKeyB && !headersA.some(hA => normHeader(hA) === normHeader(hB))
  );

  if (suggestedCols.length > 0) {
    out.selectedColsB = suggestedCols;
  } else if (headersB.length > 1) {
    const firstOther = headersB.find(h => h !== bestKeyB);
    if (firstOther) out.selectedColsB = [firstOther];
  }

  return out;
}
