import fs from 'node:fs/promises';
import path from 'node:path';

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

const root = new URL('..', import.meta.url).pathname;
const src = path.join(root, 'src', 'db', 'migrations');
const dest = path.join(root, 'dist', 'db', 'migrations');

await copyDir(src, dest);
