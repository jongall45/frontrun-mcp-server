#!/usr/bin/env node

/**
 * Frontrun MCP Server
 *
 * Gives AI agents native access to Frontrun's social signal intelligence API.
 * Wraps all /v1 endpoints as MCP tools.
 *
 * Auth: Set FRONTRUN_API_KEY env var (get one at https://frontrun.vc → Settings → API Keys)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_URL = process.env.FRONTRUN_API_URL || 'https://signal-production-0952.up.railway.app';
const API_KEY = process.env.FRONTRUN_API_KEY || '';

if (!API_KEY) {
  console.error('FRONTRUN_API_KEY environment variable is required.');
  console.error('Get your API key at https://frontrun.vc → Settings → API Keys');
  process.exit(1);
}

// ============================================================
// API CLIENT
// ============================================================

async function apiCall(method, path, body = null) {
  const url = `${API_URL}/v1${path}`;
  const options = {
    method,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  options.signal = controller.signal;

  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') return { error: 'Request timed out (60s). Try a narrower query.' };
    return { error: `Network error: ${err.message}` };
  }
  clearTimeout(timeout);

  if (response.status === 429) {
    const retry = response.headers.get('Retry-After') || '60';
    return { error: `Rate limited. Retry in ${retry}s.` };
  }
  if (response.status === 401) {
    return { error: 'Invalid API key. Check FRONTRUN_API_KEY.' };
  }
  if (response.status === 402) {
    const data = await response.json();
    return { error: 'Insufficient balance', ...data };
  }
  if (!response.ok) {
    const text = await response.text();
    return { error: `HTTP ${response.status}: ${text.slice(0, 500)}` };
  }

  return response.json();
}

// ============================================================
// MCP SERVER
// ============================================================

const server = new McpServer({
  name: 'frontrun',
  version: '1.0.0',
});

// --- GET /v1/status ---
server.tool(
  'frontrun_status',
  'Get account status: balance, tracked account count, usage stats (last 30 days), and pricing.',
  {},
  async () => {
    const result = await apiCall('GET', '/status');
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/track ---
server.tool(
  'frontrun_list_tracked',
  'List all accounts currently being monitored for follow activity.',
  {},
  async () => {
    const result = await apiCall('GET', '/track');
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- POST /v1/track ---
server.tool(
  'frontrun_track',
  'Start monitoring a Twitter/X account. When this account follows someone new, it will appear in new follows and convergence data. Costs $0.10 for standalone users, free for SaaS Pro+.',
  { username: z.string().describe('Twitter/X username to track (without @)') },
  async ({ username }) => {
    const result = await apiCall('POST', '/track', { username });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- DELETE /v1/track/:username ---
server.tool(
  'frontrun_untrack',
  'Stop monitoring a Twitter/X account.',
  { username: z.string().describe('Twitter/X username to stop tracking (without @)') },
  async ({ username }) => {
    const result = await apiCall('DELETE', `/track/${encodeURIComponent(username)}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/follows/new ---
server.tool(
  'frontrun_new_follows',
  'Detect new follows across tracked accounts by diffing consecutive snapshots. Returns who each tracked account recently followed. Use this to see what VCs/accounts noticed recently.',
  {
    since: z.string().optional().describe('Time window: "24h", "48h", "7d", "14d", "30d", or ISO date. Default: "24h"'),
    username: z.string().optional().describe('Filter to a specific tracked account username'),
    classify: z.boolean().optional().describe('Include AI classification (sector, entity type) for each new follow'),
  },
  async ({ since, username, classify }) => {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (username) params.set('username', username);
    if (classify) params.set('classify', 'true');
    const qs = params.toString();
    const result = await apiCall('GET', `/follows/new${qs ? '?' + qs : ''}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/follows/snapshot/:username ---
server.tool(
  'frontrun_snapshot',
  'Get the current follow list (latest snapshot) for a tracked account. Shows everyone they currently follow.',
  {
    username: z.string().describe('Twitter/X username of the tracked account'),
  },
  async ({ username }) => {
    const result = await apiCall('GET', `/follows/snapshot/${encodeURIComponent(username)}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/convergence ---
server.tool(
  'frontrun_convergence',
  'Detect convergence: entities followed by multiple tracked accounts independently within a time window. Higher threshold = stronger signal. This is the highest-signal endpoint — when 3+ VCs independently follow the same account, it strongly suggests pre-funding interest.',
  {
    threshold: z.number().optional().describe('Minimum number of tracked accounts that must have followed. Default: 2. Use 3+ for high-conviction signals.'),
    since: z.string().optional().describe('Time window: "48h", "7d", "14d", "30d", or ISO date. Default: "7d"'),
  },
  async ({ threshold, since }) => {
    const params = new URLSearchParams();
    if (threshold) params.set('threshold', String(threshold));
    if (since) params.set('since', since);
    const qs = params.toString();
    const result = await apiCall('GET', `/convergence${qs ? '?' + qs : ''}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/trending ---
server.tool(
  'frontrun_trending',
  'Get entities ranked by number of tracked accounts that recently followed them. Sorted by follower_count descending. Use this for daily deal flow — see what VCs are paying attention to.',
  {
    since: z.string().optional().describe('Time window: "24h", "48h", "7d", "14d", "30d", or ISO date. Default: "7d"'),
    limit: z.number().optional().describe('Maximum results (max 100). Default: 25'),
    classify: z.boolean().optional().describe('Include AI classification (sector, entity type)'),
  },
  async ({ since, limit, classify }) => {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (limit) params.set('limit', String(limit));
    if (classify) params.set('classify', 'true');
    const qs = params.toString();
    const result = await apiCall('GET', `/trending${qs ? '?' + qs : ''}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/vc/:username/activity ---
server.tool(
  'frontrun_account_activity',
  'Get activity profile for a tracked account: follow velocity, sector distribution, snapshot coverage, and recent follows with classification. Use this to analyze a specific VC\'s recent behavior.',
  {
    username: z.string().describe('Twitter/X username of the tracked account'),
    since: z.string().optional().describe('Time window: "7d", "30d", "90d", or ISO date. Default: "30d"'),
  },
  async ({ username, since }) => {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    const qs = params.toString();
    const result = await apiCall('GET', `/vc/${encodeURIComponent(username)}/activity${qs ? '?' + qs : ''}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/search ---
server.tool(
  'frontrun_search',
  'Search discovered entities by sector, keyword, or entity type. Searches across all accounts followed by your tracked set. Use this to find companies in a specific space.',
  {
    sector: z.string().optional().describe('Filter by sector: "AI/ML", "Fintech", "Enterprise SaaS", "Crypto/Web3", "Healthcare", "Climate", etc.'),
    keyword: z.string().optional().describe('Search keyword (matches username, sector, bio)'),
    entity_type: z.string().optional().describe('Filter by type: "startup", "growth_company", "enterprise", "vc_fund", "accelerator", "media", "individual"'),
    limit: z.number().optional().describe('Max results (max 200). Default: 50'),
  },
  async ({ sector, keyword, entity_type, limit }) => {
    const params = new URLSearchParams();
    if (sector) params.set('sector', sector);
    if (keyword) params.set('keyword', keyword);
    if (entity_type) params.set('entity_type', entity_type);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    const result = await apiCall('GET', `/search${qs ? '?' + qs : ''}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- POST /v1/classify/rules ---
server.tool(
  'frontrun_create_rule',
  'Create a custom classification rule. Rules auto-tag entities matching conditions (bio keywords, sector, username pattern). Use this to build custom watchlists, sector taxonomies, or competitor tracking.',
  {
    name: z.string().describe('Human-readable rule name, e.g. "DeFi Protocols"'),
    conditions: z.object({
      bio_keywords: z.array(z.string()).optional().describe('Keywords to match in bio (any match triggers)'),
      username_pattern: z.string().optional().describe('Regex pattern for username'),
      sector_contains: z.string().optional().describe('Match entities in this sector'),
      must_be_company: z.boolean().optional().describe('Only match companies (true) or individuals (false)'),
    }).describe('Conditions that must ALL be met'),
    actions: z.object({
      custom_sector: z.string().optional().describe('Override sector classification'),
      custom_entity_type: z.string().optional().describe('Override entity type'),
      tags: z.array(z.string()).optional().describe('Tags to apply, e.g. ["watchlist", "competitor"]'),
      priority: z.string().optional().describe('"high", "medium", or "low"'),
    }).describe('What to apply when conditions match'),
  },
  async ({ name, conditions, actions }) => {
    const result = await apiCall('POST', '/classify/rules', { name, conditions, actions });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/classify/rules ---
server.tool(
  'frontrun_list_rules',
  'List your custom classification rules.',
  {},
  async () => {
    const result = await apiCall('GET', '/classify/rules');
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- PUT /v1/classify/rules/:id ---
server.tool(
  'frontrun_update_rule',
  'Update an existing custom classification rule.',
  {
    id: z.string().describe('Rule UUID to update'),
    name: z.string().optional().describe('New rule name'),
    conditions: z.object({
      bio_keywords: z.array(z.string()).optional().describe('Keywords to match in bio'),
      username_pattern: z.string().optional().describe('Regex pattern for username'),
      sector_contains: z.string().optional().describe('Match entities in this sector'),
      must_be_company: z.boolean().optional().describe('Only match companies'),
    }).optional().describe('Updated conditions'),
    actions: z.object({
      custom_sector: z.string().optional().describe('Override sector classification'),
      custom_entity_type: z.string().optional().describe('Override entity type'),
      tags: z.array(z.string()).optional().describe('Tags to apply'),
      priority: z.string().optional().describe('"high", "medium", or "low"'),
    }).optional().describe('Updated actions'),
    active: z.boolean().optional().describe('Enable or disable the rule'),
  },
  async ({ id, name, conditions, actions, active }) => {
    const body = {};
    if (name !== undefined) body.name = name;
    if (conditions !== undefined) body.conditions = conditions;
    if (actions !== undefined) body.actions = actions;
    if (active !== undefined) body.active = active;
    const result = await apiCall('PUT', `/classify/rules/${id}`, body);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- DELETE /v1/classify/rules/:id ---
server.tool(
  'frontrun_delete_rule',
  'Delete a custom classification rule.',
  { id: z.string().describe('Rule UUID to delete') },
  async ({ id }) => {
    const result = await apiCall('DELETE', `/classify/rules/${id}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- POST /v1/tags ---
server.tool(
  'frontrun_tag',
  'Add custom tags, sector override, or notes to a specific entity. Use this to build custom watchlists, mark competitors, or annotate companies.',
  {
    twitter_user_id: z.string().optional().describe('Twitter user ID of the entity'),
    username: z.string().optional().describe('Username of the entity (alternative to twitter_user_id)'),
    tags: z.array(z.string()).optional().describe('Tags to apply, e.g. ["watchlist", "portfolio", "competitor"]'),
    custom_sector: z.string().optional().describe('Custom sector override'),
    custom_entity_type: z.string().optional().describe('Custom entity type override'),
    notes: z.string().optional().describe('Free-text notes about this entity'),
  },
  async ({ twitter_user_id, username, tags, custom_sector, custom_entity_type, notes }) => {
    const body = {};
    if (twitter_user_id) body.twitter_user_id = twitter_user_id;
    if (username) body.username = username;
    if (tags) body.tags = tags;
    if (custom_sector) body.custom_sector = custom_sector;
    if (custom_entity_type) body.custom_entity_type = custom_entity_type;
    if (notes !== undefined) body.notes = notes;
    const result = await apiCall('POST', '/tags', body);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/tags ---
server.tool(
  'frontrun_list_tags',
  'List your custom-tagged entities. Filter by tag name or sector.',
  {
    tag: z.string().optional().describe('Filter by tag name'),
    sector: z.string().optional().describe('Filter by custom sector'),
  },
  async ({ tag, sector }) => {
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    if (sector) params.set('sector', sector);
    const qs = params.toString();
    const result = await apiCall('GET', `/tags${qs ? '?' + qs : ''}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- POST /v1/classify ---
server.tool(
  'frontrun_classify',
  'Run classification on specific entities. Returns AI classification merged with your custom rules and tags. Use this to analyze entities on demand.',
  {
    usernames: z.array(z.string()).optional().describe('Usernames to classify'),
    twitter_user_ids: z.array(z.string()).optional().describe('Twitter user IDs to classify'),
  },
  async ({ usernames, twitter_user_ids }) => {
    const body = {};
    if (usernames) body.usernames = usernames;
    if (twitter_user_ids) body.twitter_user_ids = twitter_user_ids;
    const result = await apiCall('POST', '/classify', body);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// --- GET /v1/follows/enriched ---
server.tool(
  'frontrun_enriched_follows',
  'Get new follows with full enrichment: AI classification + your custom rules + your custom tags, all merged. This is the most powerful endpoint for custom workflows.',
  {
    since: z.string().optional().describe('Time window: "24h", "48h", "7d", etc. Default: "24h"'),
    username: z.string().optional().describe('Filter to a specific tracked account'),
  },
  async ({ since, username }) => {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (username) params.set('username', username);
    const qs = params.toString();
    const result = await apiCall('GET', `/follows/enriched${qs ? '?' + qs : ''}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

// ============================================================
// START
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
