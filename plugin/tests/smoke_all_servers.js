#!/usr/bin/env node
/**
 * Smoke test: spawn each MCP server via stdio, send initialize + tools/list,
 * verify the expected tool names are exposed, then exit. No backend calls.
 */

const { spawn } = require('child_process');
const path = require('path');

const EXPECTED = {
  'rag-core': ['rag_meta', 'rag_health', 'search_all', 'chat_ask', 'chat_session_create',
               'chat_session_get', 'chat_session_delete', 'chat_session_stream',
               'admin_list_collections', 'admin_clear_cache', 'admin_embed_probe'],
  'rag-law-core': ['law_search_articles', 'law_get_law', 'law_search_decisions', 'law_get_decision', 'law_get_references'],
  'rag-parliament': ['parliament_search', 'parliament_get_business', 'parliament_run_sql',
                     'parliament_get_debate', 'parliament_get_cosigners', 'parliament_get_timeline'],
  'rag-votes': ['votes_search', 'votes_get_vote', 'votes_timeline'],
  'rag-stats': ['stat_discover_datasets', 'stat_list_tables', 'stat_get_schema',
                'stat_run_sql', 'stat_list_topics', 'stat_cross_query'],
  'rag-science': ['science_search', 'science_list_topics', 'science_run_sql',
                  'science_research_submit', 'science_research_coverage', 'science_research_poll'],
};

const SERVER_DIRS = {
  'rag-core': 'core',
  'rag-law-core': 'law-core',
  'rag-parliament': 'parliament',
  'rag-votes': 'votes',
  'rag-stats': 'stats',
  'rag-science': 'science',
};

function probe(serverName, serverDir) {
  return new Promise((resolve) => {
    const entry = path.resolve(__dirname, '..', 'servers', serverDir, 'index.js');
    const proc = spawn('node', [entry], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      try { proc.kill(); } catch {}
      resolve(result);
    };

    proc.stdout.on('data', (c) => {
      stdout += c.toString();
      const lines = stdout.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.id === 2 && msg.result && msg.result.tools) {
            finish({ ok: true, tools: msg.result.tools.map(t => t.name), deferred: msg.result.tools.filter(t => t.defer_loading).map(t => t.name) });
            return;
          }
        } catch {}
      }
    });
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('error', (err) => finish({ ok: false, error: err.message, stderr }));
    proc.on('exit', (code) => { if (!done) finish({ ok: false, error: `exited ${code}`, stderr }); });

    // send initialize + tools/list
    setTimeout(() => {
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1.0' } } }) + '\n');
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
    }, 100);

    setTimeout(() => finish({ ok: false, error: 'timeout', stderr }), 5000);
  });
}

(async () => {
  let failed = 0;
  for (const [serverName, expectedTools] of Object.entries(EXPECTED)) {
    const serverDir = SERVER_DIRS[serverName];
    const r = await probe(serverName, serverDir);
    if (!r.ok) {
      console.log(`FAIL  ${serverName}: ${r.error}`);
      if (r.stderr) console.log(`      stderr: ${r.stderr.trim().split('\n').slice(-3).join(' | ')}`);
      failed++;
      continue;
    }
    const missing = expectedTools.filter(t => !r.tools.includes(t));
    const extra = r.tools.filter(t => !expectedTools.includes(t));
    if (missing.length || extra.length) {
      console.log(`FAIL  ${serverName}: missing=[${missing.join(',')}] extra=[${extra.join(',')}]`);
      failed++;
    } else {
      const deferNote = r.deferred && r.deferred.length ? ` (defer_loading: ${r.deferred.length})` : '';
      console.log(`OK    ${serverName}: ${r.tools.length} tools${deferNote}`);
    }
  }
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${Object.keys(EXPECTED).length - failed}/${Object.keys(EXPECTED).length} servers`);
  process.exit(failed === 0 ? 0 : 1);
})();
