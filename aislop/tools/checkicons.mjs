// Verify every icon name used in src/ exists in the Lucide set.
import fs from 'node:fs';
import path from 'node:path';
const data = fs.readFileSync('src/lib/icondata.js', 'utf8');
const names = new Set(Object.keys(JSON.parse(data.slice(data.indexOf('{'), data.lastIndexOf('}') + 1))));
const used = new Set();
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && !p.endsWith('icondata.js')) { const s = fs.readFileSync(p, 'utf8'); for (const m of s.matchAll(/icon\(ctx,\s*'([a-z0-9-]+)'/g)) used.add(m[1]); for (const m of s.matchAll(/ic:\s*'([a-z0-9-]+)'/g)) used.add(m[1]); for (const m of s.matchAll(/icon:\s*'([a-z0-9-]+)'/g)) used.add(m[1]); for (const m of s.matchAll(/\['[^']*',\s*'([a-z0-9-]+)',\s*'[^']*'\]/g)) used.add(m[1]); } } };
walk('src');
const missing = [...used].filter((n) => !names.has(n));
console.log('icons used:', used.size, 'missing:', missing.length ? missing.join(', ') : 'none');
