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
4. UI only (no assistente IA): `npm run dev:web` (calls to `/api` will fail unless the API runs separately with `npm run dev:api`).

### Produção (Node único)

1. `npm run build`
2. `npm start` — serve `dist/` e as rotas `/api` na mesma porta (`PORT` ou padrão 3001).
