/**
 * Tiny stdio JSON-RPC MCP server framework.
 * Mirrors the protocol used by /opt/rag-stack/mcp-server/rag-mcp-server.js
 * (Protocol 2025-06-18). Pure stdlib — no @modelcontextprotocol/sdk dep.
 *
 * Tool defs may declare `defer_loading: true` (Tier-3). This is forwarded
 * verbatim to the client; clients that understand it (Anthropic Advanced
 * Tool Use) will surface those tools only via tool_search_tool.
 */

function start({ name, version, tools }) {
  process.stdin.setEncoding('utf8');
  let buffer = '';

  async function handle(message) {
    if (message.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-06-18',
          serverInfo: { name, version },
          capabilities: { tools: {} },
        },
      };
    }
    if (message.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: Object.entries(tools).map(([toolName, def]) => {
            const entry = {
              name: toolName,
              description: def.description,
              inputSchema: def.parameters || { type: 'object', properties: {} },
            };
            if (def.defer_loading) entry.defer_loading = true;
            return entry;
          }),
        },
      };
    }
    if (message.method === 'tools/call') {
      const { name: toolName, arguments: args } = message.params || {};
      const def = tools[toolName];
      if (!def) {
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        };
      }
      try {
        const result = await def.handler(args || {});
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          },
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ error: { message: err.message, stack: err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : undefined } }, null, 2) }],
            isError: true,
          },
        };
      }
    }
    if (message.method && message.method.startsWith('notifications/')) {
      return null; // notifications get no response
    }
    return {
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: 'Method not found' },
    };
  }

  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let message;
      try { message = JSON.parse(line); }
      catch (err) { console.error('[mcp] bad JSON:', err.message); continue; }
      try {
        const response = await handle(message);
        if (response) console.log(JSON.stringify(response));
      } catch (err) {
        console.error('[mcp] handler error:', err.message);
      }
    }
  });

  process.stdin.on('end', () => process.exit(0));

  console.error(`[${name} v${version}] MCP server ready (${Object.keys(tools).length} tools)`);
}

module.exports = { start };
