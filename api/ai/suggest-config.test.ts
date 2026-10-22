import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './suggest-config';

type MockRes = {
  statusCode: number;
  payload: unknown;
  headers: Record<string, string>;
  headersSent: boolean;
  status(code: number): MockRes;
  json(payload: unknown): MockRes;
  end(): MockRes;
  setHeader(name: string, value: string): void;
};

function mockRes(): MockRes {
  const res: MockRes = {
    statusCode: 0,
    payload: undefined,
    headers: {},
    headersSent: false,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.payload = payload;
      res.headersSent = true;
      return res;
    },
    end() {
      res.headersSent = true;
      return res;
    },
    setHeader(name, value) {
      res.headers[name] = value;
    },
  };
  return res;
}

async function callHandler(req: unknown, res: MockRes): Promise<void> {
  await handler(req as VercelRequest, res as unknown as VercelResponse);
}

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    headers: { 'x-real-ip': '203.0.113.1' },
    body: {
      headersA: ['cpf', 'nome'],
      headersB: ['cpf', 'cargo'],
    },
    socket: {},
    ...overrides,
  };
}

const geminiBody = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              keyA: 'cpf',
              keyB: 'cpf',
              selectedColsB: ['cargo', 'coluna_invalida'],
              notes: 'Chave pelo CPF.',
            }),
          },
        ],
      },
      finishReason: 'STOP',
    },
  ],
};

function stubGeminiOk() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(geminiBody), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('POST /api/ai/suggest-config', () => {
  it('recusa métodos que não POST', async () => {
    const res = mockRes();
    await callHandler(mockReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('devolve 503 sem GEMINI_API_KEY', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const res = mockRes();
    await callHandler(mockReq({ headers: { 'x-real-ip': '203.0.113.2' } }), res);
    expect(res.statusCode).toBe(503);
  });

  it('devolve 400 para corpo inválido', async () => {
    const res = mockRes();
    await callHandler(
      mockReq({ headers: { 'x-real-ip': '203.0.113.3' }, body: { headersA: 'nao-e-array' } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it('devolve 200 e descarta colunas inexistentes', async () => {
    stubGeminiOk();
    const res = mockRes();
    await callHandler(mockReq({ headers: { 'x-real-ip': '203.0.113.4' } }), res);

    expect(res.statusCode).toBe(200);
    const payload = res.payload as {
      suggestion: { keyA: string; selectedColsB: string[] };
      warnings: string[];
      notes?: string;
    };
    expect(payload.suggestion.selectedColsB).toEqual(['cargo']);
    expect(payload.warnings.some((w) => w.includes('coluna_invalida'))).toBe(true);
    expect(payload.notes).toBe('Chave pelo CPF.');
  });

  it('devolve 502 quando o modelo responde sem conteúdo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }))
    );
    const res = mockRes();
    await callHandler(mockReq({ headers: { 'x-real-ip': '203.0.113.5' } }), res);
    expect(res.statusCode).toBe(502);
  });

  it('limita pedidos por IP com 429 e Retry-After', async () => {
    stubGeminiOk();
    const headers = { 'x-real-ip': '203.0.113.99' };
    const max = Number(process.env.AI_RATE_LIMIT_PER_MIN) || 20;

    for (let i = 0; i < max; i++) {
      const ok = mockRes();
      await callHandler(mockReq({ headers }), ok);
      expect(ok.statusCode).toBe(200);
    }

    const blocked = mockRes();
    await callHandler(mockReq({ headers }), blocked);
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['Retry-After'])).toBeGreaterThan(0);
  });
});
