import http from 'node:http';
import { URL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getOverviewV2 } from '../lib/overview_v2.js';
import { SpecView, documentHtml } from './registry.js';
import { buildOverviewSpec } from './spec_builder.js';

const PORT = Number(process.env.AGENTBUDGET_DASH_PORT ?? 8788);

function currentMonthKL(): string {
  const tz = 'Asia/Kuala_Lumpur';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  if (!y || !m) throw new Error('Failed to compute current month');
  return `${y}-${m}`;
}

function requireToken(url: URL) {
  const expected = process.env.AGENTBUDGET_DASH_TOKEN;
  if (!expected) return; // allow if unset
  const got = url.searchParams.get('token') ?? '';
  if (got !== expected) {
    const err = new Error('Unauthorized');
    // @ts-ignore
    err.statusCode = 401;
    throw err;
  }
}

function send(res: http.ServerResponse, status: number, body: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function sendJson(res: http.ServerResponse, status: number, obj: any) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj, null, 2));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('ok');
    }

    if (url.pathname === '/' || url.pathname === '/dash') {
      requireToken(url);

      const month = url.searchParams.get('month') ?? currentMonthKL();
      const question = url.searchParams.get('q') ?? undefined;

      const overview = await getOverviewV2(month);

      const title = question ? 'agentbudget — decision dashboard' : 'agentbudget — overview';
      const spec = buildOverviewSpec({ title, month, overview, question });
      const body = renderToStaticMarkup(React.createElement(SpecView, { spec }));
      return send(res, 200, documentHtml(body, title));
    }

    if (url.pathname === '/api/overview') {
      requireToken(url);
      const month = url.searchParams.get('month') ?? currentMonthKL();
      const overview = await getOverviewV2(month);
      return sendJson(res, 200, { ok: true, month, overview });
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  } catch (e: any) {
    const status = e?.statusCode ? Number(e.statusCode) : 500;
    if (req?.url?.startsWith('/api/')) return sendJson(res, status, { ok: false, error: String(e?.message ?? e) });
    return send(res, status, documentHtml(`<pre style="padding:16px">${String(e?.stack ?? e)}</pre>`, 'error'));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[agentbudget] dashboard listening on http://127.0.0.1:${PORT}`);
});
