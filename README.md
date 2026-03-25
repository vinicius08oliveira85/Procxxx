<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3a39bb1b-adca-416d-a6f0-c648f6f760eb

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Copy [.env.example](.env.example) to `.env` or `.env.local` and set **`GEMINI_API_KEY`** (used only by the Express API, not exposed in the Vite bundle).
3. Start **API + front** together: `npm run dev`  
   - Express serves `POST /api/ai/suggest-config` on port **3001**  
   - Vite serves the UI on port **3000** and proxies `/api` → 3001  
4. Só o front (`npm run dev:web`): rode em outro terminal `npm run dev:api` **e** defina no `.env.local` do projeto `VITE_API_ORIGIN=http://localhost:3001` (reinicie o Vite), ou use `npm run dev` que sobe os dois.
5. `npm run preview`: exige a API em execução na 3001 (o proxy de `/api` está configurado no Vite).

### Produção (Node único)

1. `npm run build`
2. `npm start` — serve `dist/` e as rotas `/api` na mesma porta (`PORT` ou padrão 3001).

### Deploy na Vercel

O repositório inclui [vercel.json](vercel.json) e funções em [api/](api/):

- **Build:** `npm run build` (preset Vite / `outputDirectory`: `dist`).
- **Assistente IA:** `POST /api/ai/suggest-config` é uma Serverless Function ([api/ai/suggest-config.ts](api/ai/suggest-config.ts)) que reutiliza [api/ai/suggestConfig.ts](api/ai/suggestConfig.ts) (mesmo diretório do handler + `includeFiles` no `vercel.json`). A chamada ao Gemini usa **HTTP (`fetch`)** à API oficial, sem o SDK `@google/genai`, para evitar falhas no bundle serverless.
- **Health:** `GET /api/health` ([api/health.ts](api/health.ts)).

No painel da Vercel (**Settings → Environment Variables**), defina pelo menos **`GEMINI_API_KEY`**. Opcional: **`GEMINI_MODEL`**. Não é necessário `VITE_API_ORIGIN` quando front e API estão no mesmo deploy.

**Limites:** `maxDuration` das funções está em 60s em [vercel.json](vercel.json); no plano Hobby da Vercel o máximo pode ser menor — ajuste se o deploy falhar na validação.

Fluxo: importe o repo na Vercel, confirme Framework **Vite**, faça deploy e teste **Sugerir com IA** na etapa de configuração.

Se os logs da função ainda citarem `server/suggestConfig` após um pull novo, o deploy pode estar com **cache antigo**: em **Deployments** use **⋯ → Redeploy** e marque **Clear build cache**.

Se o **manifest** ou outros assets retornarem **401** em URLs `*.vercel.app`, revise **Settings → Deployment Protection** (previews protegidos exigem login e podem bloquear o `fetch` do manifest pelo navegador).
