/**
 * API Express: proxy seguro para Gemini (chave só no servidor).
 * Em produção (NODE_ENV=production), também serve o build estático do Vite.
 */
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ZodError } from 'zod';
import { runSuggestConfig } from './suggestConfig.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env.local') });
dotenv.config({ path: path.join(rootDir, '.env') });
const distDir = path.join(rootDir, 'dist');

const app = express();

const isProd = process.env.NODE_ENV === 'production';

/** Em dev, permite chamar a API direto de outra origem (ex.: só Vite na 3000 + API na 3001). */
if (!isProd) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
}

app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) });
});
const port = Number(process.env.PORT) || 3001;
const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

app.post('/api/ai/suggest-config', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'Serviço de IA indisponível: defina GEMINI_API_KEY no ambiente do servidor.',
    });
    return;
  }

  try {
    const result = await runSuggestConfig(req.body, apiKey, defaultModel);
    res.json(result);
  } catch (e) {
    if (e instanceof ZodError) {
      res.status(400).json({ error: 'Corpo da requisição inválido.' });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'MODEL_SCHEMA_MISMATCH' || msg === 'MODEL_JSON_PARSE') {
      res.status(502).json({ error: 'A resposta do modelo não pôde ser interpretada. Tente novamente.' });
      return;
    }
    if (msg === 'EMPTY_MODEL_RESPONSE') {
      res.status(502).json({ error: 'O modelo não retornou conteúdo. Tente novamente.' });
      return;
    }
    console.error('[suggest-config]', msg);
    res.status(502).json({ error: 'Falha ao consultar o modelo. Tente novamente mais tarde.' });
  }
});

if (isProd && fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, () => {
  if (isProd) {
    console.log(`Servidor em http://localhost:${port} (API + estático)`);
  } else {
    console.log(`API em http://localhost:${port} (desenvolvimento; use Vite na porta 3000)`);
  }
});
