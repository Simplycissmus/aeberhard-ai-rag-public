#!/usr/bin/env node
/**
 * Parse each server file, count handlers declared, and report totals.
 * Quick sanity that the 31-tool target is met without spawning servers.
 */

const fs = require('fs');
const path = require('path');

const SERVERS = ['core', 'law-core', 'parliament', 'votes', 'stats', 'science'];
let total = 0;
for (const s of SERVERS) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'servers', s, 'index.js'), 'utf8');
  // crude: count `: {\n    description:` in the tools object
  const matches = src.match(/^\s{2}[a-z_]+:\s*\{\s*$/gm) || [];
  const handlerCount = (src.match(/handler:\s*async/g) || []).length;
  console.log(`${s.padEnd(12)}  ${handlerCount} tools`);
  total += handlerCount;
}
console.log(`\nTotal: ${total} tools  (target: 31 Tier-1/2 + 6 Tier-3 deferred = 37)`);
process.exit(total === 37 ? 0 : 1);
