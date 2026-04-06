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
import { runSuggestConfig } from '../api/ai/suggest-config.ts';
import { runStructurize, structurizeBodySchema } from '../api/ai/structurize.ts';

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
const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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
    if (msg === 'GEMINI_AUTH') {
      console.error('[suggest-config][gemini] auth rejected (401/403)');
      res.status(502).json({
        error: 'Chave Gemini inválida ou sem permissão. Confira GEMINI_API_KEY no .env / .env.local.',
      });
      return;
    }
    if (msg === 'GEMINI_NETWORK') {
      console.error('[suggest-config][gemini] network error (detalhe já logado em api/ai/suggest-config)');
      res.status(502).json({
        error: 'Não foi possível contactar a API do Gemini (rede). Tente de novo.',
      });
      return;
    }
    if (msg.startsWith('GEMINI_HTTP_429')) {
      const retryM = /Please retry in ([\d.]+)s/i.exec(msg);
      const sec = retryM ? Math.ceil(parseFloat(retryM[1])) : undefined;
      const waitHint =
        sec != null && sec > 0 ? ` Tente de novo daqui a cerca de ${sec}s.` : ' Aguarde um minuto e tente de novo.';
      console.error('[suggest-config][gemini] quota / rate limit (429)', msg);
      res.status(429).json({
        error:
          'Limite de uso do Gemini atingido (cota do plano gratuito ou pedidos por minuto).' +
          waitHint +
          ' Consulte limites e faturação: https://ai.google.dev/gemini-api/docs/rate-limits',
      });
      return;
    }
    if (msg.startsWith('GEMINI_HTTP_')) {
      console.error('[suggest-config][gemini] upstream HTTP (detalhe já logado em api/ai/suggest-config)', msg);
      res.status(502).json({
        error: 'A API do Gemini recusou a requisição. Verifique cota e GEMINI_MODEL (veja o terminal para detalhes).',
      });
      return;
    }
    if (msg === 'MODEL_OUTPUT_TRUNCATED') {
      console.error('[suggest-config][gemini] output truncated (MAX_TOKENS + JSON inválido)');
      res.status(502).json({
        error:
          'A resposta do modelo foi cortada pelo limite de tamanho. Tente de novo ou reduza o número de colunas na tabela B.',
      });
      return;
    }
    if (msg === 'MODEL_SCHEMA_MISMATCH' || msg === 'MODEL_JSON_PARSE') {
      console.error('[suggest-config][gemini] parse/schema (detalhe já logado em api/ai/suggest-config)', msg);
      res.status(502).json({ error: 'A resposta do modelo não pôde ser interpretada. Tente novamente.' });
      return;
    }
    if (msg === 'EMPTY_MODEL_RESPONSE') {
      console.error('[suggest-config][gemini] empty output (detalhe já logado em api/ai/suggest-config)');
      res.status(502).json({ error: 'O modelo não retornou conteúdo. Tente novamente.' });
      return;
    }
    console.error('[suggest-config] unexpected', msg, e);
    res.status(502).json({ error: 'Falha ao consultar o modelo. Tente novamente mais tarde.' });
  }
});

app.post('/api/ai/structurize', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'Serviço de IA indisponível: defina GEMINI_API_KEY no ambiente do servidor.',
    });
    return;
  }

  try {
    const { text } = structurizeBodySchema.parse(req.body);
    const result = await runStructurize(text, apiKey, defaultModel);
    res.json(result);
  } catch (e) {
    if (e instanceof ZodError) {
      res.status(400).json({ error: 'Corpo inválido: envie { "text": string } com 1–100000 caracteres.' });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'GEMINI_AUTH') {
      console.error('[structurize][gemini] auth rejected (401/403)');
      res.status(502).json({
        error: 'Chave Gemini inválida ou sem permissão. Confira GEMINI_API_KEY no .env / .env.local.',
      });
      return;
    }
    if (msg === 'GEMINI_NETWORK') {
      console.error('[structurize][gemini] network error');
      res.status(502).json({
        error: 'Não foi possível contactar a API do Gemini (rede). Tente de novo.',
      });
      return;
    }
    if (msg.startsWith('GEMINI_HTTP_429')) {
      const retryM = /Please retry in ([\d.]+)s/i.exec(msg);
      const sec = retryM ? Math.ceil(parseFloat(retryM[1])) : undefined;
      const waitHint =
        sec != null && sec > 0 ? ` Tente de novo daqui a cerca de ${sec}s.` : ' Aguarde um minuto e tente de novo.';
      console.error('[structurize][gemini] quota / rate limit (429)', msg);
      res.status(429).json({
        error:
          'Limite de uso do Gemini atingido (cota do plano gratuito ou pedidos por minuto).' +
          waitHint +
          ' Consulte limites e faturação: https://ai.google.dev/gemini-api/docs/rate-limits',
      });
      return;
    }
    if (msg.startsWith('GEMINI_HTTP_')) {
      console.error('[structurize][gemini] upstream HTTP', msg);
      res.status(502).json({
        error: 'A API do Gemini recusou a requisição. Verifique cota e GEMINI_MODEL (veja o terminal para detalhes).',
      });
      return;
    }
    if (msg === 'STRUCTURIZE_INVALID_ROWS') {
      console.error('[structurize] invalid rows shape from model');
      res.status(502).json({
        error:
          'A resposta do modelo não contém um array "rows" de objetos válido. Tente novamente ou reduza o tamanho do texto.',
      });
      return;
    }
    if (msg === 'MODEL_JSON_PARSE' || msg === 'EMPTY_MODEL_RESPONSE') {
      console.error('[structurize][gemini] parse/empty output', msg);
      res.status(502).json({ error: 'A resposta do modelo não pôde ser interpretada. Tente novamente.' });
      return;
    }
    console.error('[structurize] unexpected', msg, e);
    res.status(502).json({ error: 'Falha ao estruturar o texto. Tente novamente mais tarde.' });
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
