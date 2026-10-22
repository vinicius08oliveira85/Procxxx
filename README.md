# Excel Lookup Master

Cruzamento de planilhas no navegador, no espírito do PROCV/XLOOKUP: importe a tabela base (A), a tabela de busca (B) e, opcionalmente, uma terceira fonte (C); escolha as chaves, traga as colunas de retorno, filtre, gere tabela dinâmica e exporte em Excel/JSON.

Todo o processamento das planilhas acontece no browser. Só o assistente de IA envia dados a um servidor, e a chave da API nunca vai para o bundle.

## Requisitos

- Node.js >= 20
- Chave do Google AI Studio (`GEMINI_API_KEY`) apenas se quiser usar o assistente de IA

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha GEMINI_API_KEY para o assistente
npm run dev                  # API (3001) + Vite (3000)
```

- `npm run dev` → Vite em `http://localhost:3000` com proxy de `/api` para `http://localhost:3001`
- `npm run dev:web` sozinho exige a API a correr e `VITE_API_ORIGIN=http://localhost:3001` no `.env.local`
- `npm run preview` também depende da API na 3001 (o proxy está configurado no Vite)

### Produção (processo Node único)

```bash
npm run build
npm start        # serve dist/ e /api na mesma porta (PORT, padrão 3001)
```

O `npm start` usa `tsx` em tempo de execução, portanto o processo precisa das dependências de desenvolvimento instaladas.

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | API Express + Vite em paralelo |
| `npm run build` | Build do front (`dist/`) |
| `npm run typecheck` | `tsc --noEmit` (modo `strict`) |
| `npm run lint` | ESLint (TypeScript + regras de hooks) |
| `npm test` | Vitest (motores puros, parser, rate limit) |
| `npm run check` | typecheck + lint + testes |
| `npm start` | Servidor Express que serve `dist/` e `/api` |

CI em [.github/workflows/ci.yml](.github/workflows/ci.yml) corre typecheck, lint, testes e build em cada push/PR.

## Arquitetura

- `src/App.tsx` — orquestra as etapas (upload → configuração → resultado) e o estado das operações
- `src/lib/lookupEngine.ts` — motor PROCV/XLOOKUP, puro e testado; roda no Web Worker `src/workers/lookup.worker.ts`
- `src/lib/workbookParser.ts` — leitura de planilhas, pura; roda no Web Worker `src/workers/parse.worker.ts`
- `src/lib/pivotEngine.ts` — agregação da tabela dinâmica
- `src/lib/configureMetrics.ts` — métricas do ecrã Configurar (duplicados, taxa de match)
- `src/services/aiSuggest.ts` — cliente do assistente (timeout, cancelamento e mascaramento de CPF/CNPJ/telefone/e-mail)
- `server/index.ts` — API Express de desenvolvimento/produção, com rate limit e CORS restrito a loopback
- `api/ai/*.ts` — funções serverless da Vercel; código partilhado em `api/_lib/`

### Limites e privacidade

- Upload de até **50 MB** por ficheiro (`.xlsx`, `.xls`, `.xlsb`, `.xlsm`, `.ods`, `.csv`, `.tsv`), validado antes da leitura.
- O assistente envia cabeçalhos, estatísticas e no máximo 12 linhas de amostra; valores com formato de CPF/CNPJ/telefone (9–14 dígitos) e o nome local de e-mails são mascarados antes do envio.
- O rate limit da IA (20 pedidos/min por IP, `AI_RATE_LIMIT_PER_MIN`) é em memória e por instância: é um travão de custo, não um limite distribuído. Num deploy com várias instâncias, use um store partilhado.

## Deploy na Vercel

O repositório inclui [vercel.json](vercel.json) e as funções em [api/](api/):

- Build: `npm run build` (preset Vite, `outputDirectory: dist`)
- Funções: `api/ai/suggest-config.ts` e `api/ai/structurize.ts` (chamadas ao Gemini por `fetch`, sem SDK)
- Health: `GET /api/health`

Em **Settings → Environment Variables** defina:

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `GEMINI_API_KEY` | para o assistente | chave do Google AI Studio |
| `GEMINI_MODEL` | não | padrão `gemini-2.5-flash` |
| `AI_RATE_LIMIT_PER_MIN` | não | padrão 20 |

Não defina `VITE_API_ORIGIN` no mesmo deploy: o front chama `/api` na mesma origem.

`maxDuration` das funções está em 60s no `vercel.json`; no plano Hobby o máximo pode ser menor.

### Dependência do SheetJS

`xlsx` é instalado a partir do registo do SheetJS (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), e não do npm: a versão publicada no npm (0.18.5) tem vulnerabilidades conhecidas sem correção no registo. O `npm ci` precisa de acesso a `cdn.sheetjs.com`.

## Diagnóstico do assistente

Erros 502/429 aparecem no front com mensagem amigável. Nos logs, procure os prefixos `[suggest-config][gemini]` e `[structurize][gemini]`: eles mostram `httpStatus`, `model` e a mensagem do Google, sem expor a chave.

Se aparecer `free_tier` ou `limit: 0`, a cota do plano gratuito acabou — ative faturação ou aguarde. Se o campo `model` nos logs não for o esperado, apague `GEMINI_MODEL` na Vercel e faça Redeploy (um valor antigo na env sobrepõe-se ao default).
