import React from 'react';
import { defineRegistry, JSONUIProvider, Renderer } from '@json-render/react';
import { budgetCatalog } from './catalog.js';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

const styles = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b1020; color: #e8eefc; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
  a { color: inherit; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 24px 16px 64px; }
  .title { font-size: 22px; font-weight: 700; margin: 0 0 14px; }
  .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; }
  .card { grid-column: span 12; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 14px; }
  .card h3 { margin: 0 0 10px; font-size: 14px; font-weight: 700; color: rgba(232,238,252,0.9); }
  .section { margin: 14px 0 8px; font-size: 13px; letter-spacing: 0.2px; color: rgba(232,238,252,0.85); font-weight: 700; text-transform: uppercase; }
  .metric { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .metric:last-child { border-bottom: none; }
  .metric .label { color: rgba(232,238,252,0.75); font-size: 13px; }
  .metric .value { font-size: 16px; font-weight: 800; }
  .tone-good { color: #7CFFB2; }
  .tone-warn { color: #FFD36E; }
  .tone-bad { color: #FF7C91; }
  .alert { border-radius: 12px; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.10); }
  .alert.info { background: rgba(120, 180, 255, 0.10); }
  .alert.good { background: rgba(124, 255, 178, 0.10); }
  .alert.warn { background: rgba(255, 211, 110, 0.10); }
  .alert.bad { background: rgba(255, 124, 145, 0.10); }
  .alert .at { font-weight: 800; margin-bottom: 4px; }
  .list-title { font-weight: 800; margin: 0 0 8px; }
  ul { margin: 0; padding-left: 18px; color: rgba(232,238,252,0.85); }
  li { margin: 6px 0; }
  .divider { height: 1px; background: rgba(255,255,255,0.10); margin: 12px 0; }
`;

export function documentHtml(body: string, title = 'agentbudget dashboard') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const { registry } = defineRegistry(budgetCatalog, {
  components: {
    Page: ({ props, children }) => (
      <div className="wrap">
        {props.title ? <h1 className="title">{props.title}</h1> : null}
        <div className="grid">{children}</div>
      </div>
    ),
    Section: ({ props }) => <div className="section" style={{ gridColumn: 'span 12' }}>{props.title}</div>,
    Card: ({ props, children }) => (
      <div className="card">
        {props.title ? <h3>{props.title}</h3> : null}
        {children}
      </div>
    ),
    Metric: ({ props }) => (
      <div className="metric">
        <div className="label">{props.label}</div>
        <div className={cx('value', props.tone === 'good' && 'tone-good', props.tone === 'warn' && 'tone-warn', props.tone === 'bad' && 'tone-bad')}>{props.value}</div>
      </div>
    ),
    Alert: ({ props }) => (
      <div className={cx('alert', props.tone)} style={{ gridColumn: 'span 12' }}>
        {props.title ? <div className="at">{props.title}</div> : null}
        <div>{props.message}</div>
      </div>
    ),
    List: ({ props }) => (
      <div style={{ gridColumn: 'span 12' }}>
        {props.title ? <div className="list-title">{props.title}</div> : null}
        <ul>
          {props.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      </div>
    ),
    Divider: () => <div className="divider" style={{ gridColumn: 'span 12' }} />,
  },
});

export function SpecView({ spec }: { spec: any }) {
  return (
    <JSONUIProvider registry={registry} initialState={{}}>
      <Renderer spec={spec} registry={registry} />
    </JSONUIProvider>
  );
}
