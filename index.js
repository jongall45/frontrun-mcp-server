#!/usr/bin/env node

/**
 * Frontrun MCP Server v2
 *
 * Gives AI agents native access to Frontrun's social signal intelligence API.
 * All tools return computed, synthesized intelligence — no raw data pass-throughs.
 *
 * Auth: Set FRONTRUN_API_KEY env var (get one at https://frontrun.vc → Settings → API Keys)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

// ============================================================
// --setup: One-command install for Claude Desktop
// --setup-code: One-command install for Claude Code
// ============================================================

const args = process.argv.slice(2);

if (args[0] === '--setup' || args[0] === '--setup-code') {
  let apiKey = args[1];
  // If no key provided, use saved credentials from --login
  if (!apiKey || !apiKey.startsWith('sig_')) {
    const credsDir = join(homedir(), '.frontrun');
    const credsPath = join(credsDir, 'credentials.json');
    try {
      if (existsSync(credsPath)) {
        const creds = JSON.parse(readFileSync(credsPath, 'utf8'));
        if (creds.api_key) {
          apiKey = creds.api_key;
          console.log(`\n  Using saved credentials${creds.user ? ` (${creds.user})` : ''}`);
        }
      }
    } catch {}
  }
  if (!apiKey || !apiKey.startsWith('sig_')) {
    console.error('\n  No API key found. Either:');
    console.error('    1. Log in first:  npx frontrun-mcp-server --login');
    console.error('    2. Pass a key:    npx frontrun-mcp-server --setup YOUR_API_KEY\n');
    process.exit(1);
  }

  if (args[0] === '--setup-code') {
    // Claude Code: use `claude mcp add`
    try {
      execSync(`claude mcp add frontrun -e FRONTRUN_API_KEY=${apiKey} -- npx frontrun-mcp-server`, { stdio: 'inherit' });
      console.log('\n  ✓ Frontrun MCP server added to Claude Code.\n  Restart Claude Code to connect.\n');
    } catch {
      console.error('\n  Failed to run `claude mcp add`. Is Claude Code installed?\n');
      process.exit(1);
    }
    process.exit(0);
  }

  // Claude Desktop: write to config file
  const platform = process.platform;
  const configDir = platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support', 'Claude')
    : platform === 'win32'
      ? join(process.env.APPDATA || '', 'Claude')
      : join(homedir(), '.config', 'claude');

  const configPath = join(configDir, 'claude_desktop_config.json');

  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      // Corrupted file, start fresh
    }
  } else {
    mkdirSync(configDir, { recursive: true });
  }

  if (!config.mcpServers) config.mcpServers = {};
  config.mcpServers.frontrun = {
    command: 'npx',
    args: ['frontrun-mcp-server'],
    env: { FRONTRUN_API_KEY: apiKey },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`\n  ✓ Frontrun MCP server installed.`);
  console.log(`    Config: ${configPath}`);
  console.log(`\n  Restart Claude Desktop to connect.\n`);
  process.exit(0);
}

// ============================================================
// Credential storage helpers
// ============================================================

const CREDENTIALS_DIR = process.platform === 'darwin'
  ? join(homedir(), '.frontrun')
  : process.platform === 'win32'
    ? join(process.env.APPDATA || homedir(), 'frontrun')
    : join(homedir(), '.config', 'frontrun');

const CREDENTIALS_PATH = join(CREDENTIALS_DIR, 'credentials.json');

function loadCredentials() {
  try {
    if (existsSync(CREDENTIALS_PATH)) {
      return JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'));
    }
  } catch {}
  return null;
}

function saveCredentials(apiKey, user) {
  mkdirSync(CREDENTIALS_DIR, { recursive: true });
  const data = JSON.stringify({ api_key: apiKey, user, created_at: new Date().toISOString() }, null, 2);
  writeFileSync(CREDENTIALS_PATH, data, { mode: 0o600 });
}

function clearCredentials() {
  try {
    if (existsSync(CREDENTIALS_PATH)) {
      unlinkSync(CREDENTIALS_PATH);
    }
  } catch {}
}

// ============================================================
// --login: Interactive OAuth login flow
// --logout: Clear stored credentials
// --status: Show current auth status
// ============================================================

if (args[0] === '--logout') {
  clearCredentials();
  console.log('\n  ✓ Logged out. Credentials removed.\n');
  process.exit(0);
}

if (args[0] === '--status') {
  const creds = loadCredentials();
  if (creds) {
    console.log(`\n  Logged in as: ${creds.user || 'unknown'}`);
    console.log(`  Key: sig_••••••••${creds.api_key.slice(-8)}`);
    console.log(`  Stored: ${CREDENTIALS_PATH}\n`);
  } else if (process.env.FRONTRUN_API_KEY) {
    console.log(`\n  Using env var FRONTRUN_API_KEY: sig_••••••••${process.env.FRONTRUN_API_KEY.slice(-8)}\n`);
  } else {
    console.log('\n  Not authenticated. Run: npx frontrun-mcp-server --login\n');
  }
  process.exit(0);
}

async function interactiveLogin(apiUrl) {
  // Init session — server generates the session_id
  const initRes = await fetch(`${apiUrl}/api/mcp/auth/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!initRes.ok) {
    console.error('\n  Failed to start login session.\n');
    process.exit(1);
  }
  const { session_id: sessionId, login_url: rawUrl } = await initRes.json();
  // Normalize double slashes in path (e.g. https://frontrun.vc//mcp → https://frontrun.vc/mcp)
  const login_url = rawUrl.replace(/(https?:\/\/)|(\/)+/g, (m, proto) => proto || '/');

  // Open browser
  console.error(`\n  Opening browser to log in...`);
  console.error(`  If it doesn't open, visit: ${login_url}\n`);
  try {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    execSync(`${cmd} "${login_url}"`, { stdio: 'ignore' });
  } catch {
    // Browser didn't open, URL already printed above
  }

  // Poll for approval (up to 5 minutes)
  console.error('  Waiting for approval...');
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const pollRes = await fetch(`${apiUrl}/api/mcp/auth/poll?session=${sessionId}`);
      const result = await pollRes.json();

      if (result.status === 'approved') {
        saveCredentials(result.api_key, result.user);
        console.error(`\n  ✓ Logged in as ${result.user}. Credentials saved.\n`);
        return result.api_key;
      }
      if (result.status === 'expired') {
        console.error('\n  Session expired. Try again: npx frontrun-mcp-server --login\n');
        process.exit(1);
      }
    } catch {
      // Network error, keep polling
    }
  }
  console.error('\n  Timed out waiting for approval.\n');
  process.exit(1);
}

// ============================================================
// Normal MCP server startup — resolve API key
// ============================================================

const API_URL = process.env.FRONTRUN_API_URL || 'https://signal-production-0952.up.railway.app';

// Auth resolution: env var → stored credentials → interactive login
let API_KEY = process.env.FRONTRUN_API_KEY || '';

if (!API_KEY) {
  const creds = loadCredentials();
  if (creds && creds.api_key) {
    API_KEY = creds.api_key;
  }
}

if (!API_KEY || args[0] === '--login') {
  // Interactive login flow
  if (!process.stdin.isTTY && args[0] !== '--login') {
    // Non-interactive and no key — try login anyway since MCP clients pipe stdio
    API_KEY = await interactiveLogin(API_URL);
  } else {
    API_KEY = await interactiveLogin(API_URL);
  }
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
  const timeout = setTimeout(() => controller.abort(), 90000);
  options.signal = controller.signal;

  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') return { error: 'Request timed out (90s). Try a narrower query.' };
    return { error: `Network error: ${err.message}` };
  }
  clearTimeout(timeout);

  if (response.status === 429) {
    const retry = response.headers.get('Retry-After') || '60';
    return { error: `Rate limited. Retry in ${retry}s.` };
  }
  if (response.status === 401) {
    return { error: 'Not authenticated. Fix: run `npx frontrun-mcp-server --login` (browser OAuth sign-in), or set FRONTRUN_API_KEY from frontrun.vc \u2192 Settings \u2192 API Keys. API + MCP access is included with Frontrun Pro ($99/mo, 10,000 monthly credits) \u2014 plans at https://frontrun.vc/pricing' };
  }
  if (response.status === 402) {
    const data = await response.json();
    return { error: 'Insufficient credits. Top up (or enable auto-refill so agent pipelines never stall) at frontrun.vc/api/billing.', ...data };
  }
  if (!response.ok) {
    const text = await response.text();
    return { error: `HTTP ${response.status}: ${text.slice(0, 500)}` };
  }

  return response.json();
}

function buildQS(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? '?' + s : '';
}

function result(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

// ============================================================
// MCP SERVER
// ============================================================

const server = new McpServer({
  name: 'frontrun',
  version: '2.5.0',
});

// ============================================================
// ACCOUNT
// ============================================================

server.tool(
  'frontrun_status',
  'Get account status: credit balance, tracked account count, usage stats, and pricing.',
  {},
  async () => result(await apiCall('GET', '/status'))
);

// ============================================================
// TRACKING
// ============================================================

server.tool(
  'frontrun_list_tracked',
  'List all accounts currently being monitored for follow activity.',
  {},
  async () => result(await apiCall('GET', '/track'))
);

server.tool(
  'frontrun_track',
  'Start monitoring a Twitter/X account for follow activity. 4 credits/account.',
  { username: z.string().describe('Twitter/X handle to track (without @)') },
  async ({ username }) => result(await apiCall('POST', '/track', { username }))
);

server.tool(
  'frontrun_untrack',
  'Stop monitoring a Twitter/X account.',
  { username: z.string().describe('Twitter/X handle to stop tracking (without @)') },
  async ({ username }) => result(await apiCall('DELETE', `/track/${encodeURIComponent(username)}`))
);

server.tool(
  'frontrun_preview',
  'Preview an account before tracking. Returns profile summary, signal potential score (0-1), sector hints, and a tracking recommendation. Use this to evaluate whether an account is worth monitoring. 4 credits.',
  { handle: z.string().describe('Twitter/X handle to preview (without @)') },
  async ({ handle }) => result(await apiCall('GET', `/preview/${encodeURIComponent(handle)}`))
);

// ============================================================
// SIGNAL INTELLIGENCE
// ============================================================

server.tool(
  'frontrun_new_follows',
  'Detect new follows across tracked accounts. Returns temporal diffs — who each tracked account recently followed and when. 16 credits.',
  {
    since: z.string().optional().describe('Time window: "24h", "7d", "30d", or ISO date. Default: "24h"'),
    hours: z.number().optional().describe('Shorthand: hours to look back (e.g. 48). Alternative to since.'),
    username: z.string().optional().describe('Filter to a specific tracked account'),
    classify: z.boolean().optional().describe('Include AI classification for each new follow'),
  },
  async ({ since, hours, username, classify }) => {
    const params = {};
    if (since) params.since = since;
    else if (hours) params.hours = hours;
    if (username) params.username = username;
    if (classify) params.classify = 'true';
    return result(await apiCall('GET', `/follows/new${buildQS(params)}`));
  }
);

server.tool(
  'frontrun_snapshot',
  'Get the current follow list for a tracked account. Shows everyone they currently follow based on stored data. 4 credits.',
  { username: z.string().describe('Twitter/X handle of the tracked account') },
  async ({ username }) => result(await apiCall('GET', `/follows/snapshot/${encodeURIComponent(username)}`))
);

server.tool(
  'frontrun_enriched_follows',
  'New follows with full enrichment: AI classification + custom rules + custom tags + filtering. The most powerful signal endpoint. Use sector/keyword/entity_type filters to query like "show me all stablecoin neobanks my tracked VCs followed this week". 16 credits.',
  {
    since: z.string().optional().describe('Time window: "24h", "7d", etc. Default: "24h"'),
    hours: z.number().optional().describe('Shorthand: hours to look back'),
    username: z.string().optional().describe('Filter to a specific tracked account'),
    sector: z.string().optional().describe('Filter by sector (e.g. "DeFi", "AI", "stablecoins")'),
    keyword: z.string().optional().describe('Search keyword (matches username, name, bio, sector)'),
    entity_type: z.string().optional().describe('Filter by type: "company", "project", "person", "fund", "vc"'),
    tag: z.string().optional().describe('Filter by custom tag or rule name'),
  },
  async ({ since, hours, username, sector, keyword, entity_type, tag }) => {
    const params = {};
    if (since) params.since = since;
    else if (hours) params.hours = hours;
    if (username) params.username = username;
    if (sector) params.sector = sector;
    if (keyword) params.keyword = keyword;
    if (entity_type) params.entity_type = entity_type;
    if (tag) params.tag = tag;
    return result(await apiCall('GET', `/follows/enriched${buildQS(params)}`));
  }
);

server.tool(
  'frontrun_convergence',
  'Detect convergence: entities followed by multiple tracked accounts independently. The highest-signal endpoint — when 3+ VCs independently follow the same account, it strongly suggests pre-funding interest. 60 credits.',
  {
    min_accounts: z.number().optional().describe('Minimum tracked accounts that must follow. Default: 2. Use 3+ for high-conviction.'),
    since: z.string().optional().describe('Time window. Default: "7d"'),
    hours: z.number().optional().describe('Shorthand: hours to look back'),
  },
  async ({ min_accounts, since, hours }) => {
    const params = {};
    if (min_accounts) params.min_accounts = min_accounts;
    if (since) params.since = since;
    else if (hours) params.hours = hours;
    return result(await apiCall('GET', `/convergence${buildQS(params)}`));
  }
);

server.tool(
  'frontrun_trending',
  'Entities ranked by follow velocity — how many tracked accounts recently followed them. Use this for daily deal flow. 24 credits (+16 credits per item if classify=true).',
  {
    since: z.string().optional().describe('Time window. Default: "7d"'),
    limit: z.number().optional().describe('Max results (max 100). Default: 25'),
    classify: z.boolean().optional().describe('Include AI classification'),
  },
  async ({ since, limit, classify }) => {
    const params = {};
    if (since) params.since = since;
    if (limit) params.limit = limit;
    if (classify) params.classify = 'true';
    return result(await apiCall('GET', `/trending${buildQS(params)}`));
  }
);

server.tool(
  'frontrun_search',
  'Search discovered entities by sector, keyword, or entity type across your tracked universe. 4 credits.',
  {
    sector: z.string().optional().describe('Filter by sector: "DeFi", "AI", "Infrastructure", "Gaming", "Payments", etc.'),
    keyword: z.string().optional().describe('Search keyword (matches username, sector, bio)'),
    entity_type: z.string().optional().describe('Filter: "company", "project", "person", "fund", "vc"'),
    limit: z.number().optional().describe('Max results (max 200). Default: 50'),
  },
  async ({ sector, keyword, entity_type, limit }) => {
    const params = {};
    if (sector) params.sector = sector;
    if (keyword) params.keyword = keyword;
    if (entity_type) params.entity_type = entity_type;
    if (limit) params.limit = limit;
    return result(await apiCall('GET', `/search${buildQS(params)}`));
  }
);

server.tool(
  'frontrun_thesis_search',
  'Semantic thesis search over your database (companies surfaced by the investors you track). Describe an investment thesis in plain language (e.g. "information markets — platforms where people trade on what they know") and get companies whose descriptions match the meaning, not just the exact words. Ranked by similarity. 40 credits.',
  {
    q: z.string().describe('Investment thesis in plain language (min 10 characters)'),
    limit: z.number().optional().describe('Max results (max 50). Default: 25'),
  },
  async ({ q, limit }) => result(await apiCall('GET', `/search/thesis${buildQS({ q, limit })}`))
);

// ============================================================
// CLASSIFICATION
// ============================================================

server.tool(
  'frontrun_classify',
  'Run AI classification on specific entities. Returns sector, entity type, confidence. 16 credits/entity.',
  {
    usernames: z.array(z.string()).optional().describe('Usernames to classify'),
    twitter_user_ids: z.array(z.string()).optional().describe('Twitter user IDs to classify'),
  },
  async ({ usernames, twitter_user_ids }) => {
    const body = {};
    if (usernames) body.usernames = usernames;
    if (twitter_user_ids) body.twitter_user_ids = twitter_user_ids;
    return result(await apiCall('POST', '/classify', body));
  }
);

server.tool(
  'frontrun_create_rule',
  'Create a custom classification rule. Rules auto-tag entities matching your conditions in enriched follows and discover results. Free.',
  {
    name: z.string().describe('Rule name, e.g. "DeFi Protocols" or "stablecoin-neobank"'),
    conditions: z.object({
      bio_keywords: z.array(z.string()).optional().describe('Keywords to match in bio (any match triggers)'),
      username_pattern: z.string().optional().describe('Regex pattern for username'),
      sector_contains: z.string().optional().describe('Match entities in this sector'),
      must_be_company: z.boolean().optional().describe('Only match companies (true) or individuals (false)'),
    }).describe('Conditions that must ALL be met'),
    actions: z.object({
      custom_sector: z.string().optional().describe('Override sector classification'),
      custom_entity_type: z.string().optional().describe('Override entity type'),
      tags: z.array(z.string()).optional().describe('Tags to apply'),
      priority: z.string().optional().describe('"high", "medium", or "low"'),
    }).describe('What to apply when conditions match'),
  },
  async ({ name, conditions, actions }) => result(await apiCall('POST', '/classify/rules', { name, conditions, actions }))
);

server.tool(
  'frontrun_list_rules',
  'List your custom classification rules. Free.',
  {},
  async () => result(await apiCall('GET', '/classify/rules'))
);

server.tool(
  'frontrun_update_rule',
  'Update an existing custom classification rule. Free.',
  {
    id: z.string().describe('Rule UUID to update'),
    name: z.string().optional().describe('New rule name'),
    conditions: z.object({
      bio_keywords: z.array(z.string()).optional(),
      username_pattern: z.string().optional(),
      sector_contains: z.string().optional(),
      must_be_company: z.boolean().optional(),
    }).optional().describe('Updated conditions'),
    actions: z.object({
      custom_sector: z.string().optional(),
      custom_entity_type: z.string().optional(),
      tags: z.array(z.string()).optional(),
      priority: z.string().optional(),
    }).optional().describe('Updated actions'),
    active: z.boolean().optional().describe('Enable or disable the rule'),
  },
  async ({ id, name, conditions, actions, active }) => {
    const body = {};
    if (name !== undefined) body.name = name;
    if (conditions !== undefined) body.conditions = conditions;
    if (actions !== undefined) body.actions = actions;
    if (active !== undefined) body.active = active;
    return result(await apiCall('PUT', `/classify/rules/${id}`, body));
  }
);

server.tool(
  'frontrun_delete_rule',
  'Delete a custom classification rule. Free.',
  { id: z.string().describe('Rule UUID to delete') },
  async ({ id }) => result(await apiCall('DELETE', `/classify/rules/${id}`))
);

server.tool(
  'frontrun_tag',
  'Add custom tags, sector override, or notes to a specific entity. Free.',
  {
    twitter_user_id: z.string().optional().describe('Twitter user ID'),
    username: z.string().optional().describe('Username (alternative to twitter_user_id)'),
    tags: z.array(z.string()).optional().describe('Tags, e.g. ["watchlist", "portfolio"]'),
    custom_sector: z.string().optional().describe('Custom sector override'),
    custom_entity_type: z.string().optional().describe('Custom entity type override'),
    notes: z.string().optional().describe('Free-text notes'),
  },
  async ({ twitter_user_id, username, tags, custom_sector, custom_entity_type, notes }) => {
    const body = {};
    if (twitter_user_id) body.twitter_user_id = twitter_user_id;
    if (username) body.username = username;
    if (tags) body.tags = tags;
    if (custom_sector) body.custom_sector = custom_sector;
    if (custom_entity_type) body.custom_entity_type = custom_entity_type;
    if (notes !== undefined) body.notes = notes;
    return result(await apiCall('POST', '/tags', body));
  }
);

server.tool(
  'frontrun_list_tags',
  'List your custom-tagged entities. Free.',
  {
    tag: z.string().optional().describe('Filter by tag name'),
    sector: z.string().optional().describe('Filter by custom sector'),
  },
  async ({ tag, sector }) => result(await apiCall('GET', `/tags${buildQS({ tag, sector })}`))
);

// ============================================================
// COMPANY INTELLIGENCE
// ============================================================

server.tool(
  'frontrun_company',
  'Synthesized company overview: what they do, sector, stage, website summary, recent activity. Combines Twitter profile, website scrape, and AI classification. 60 credits.',
  { handle: z.string().describe('Twitter/X handle (without @)') },
  async ({ handle }) => result(await apiCall('GET', `/company/${encodeURIComponent(handle)}`))
);

server.tool(
  'frontrun_company_founders',
  'Founder intelligence: identifies founders via social graph analysis and enriches with LinkedIn data. Returns name, role, background, previous companies. 100 credits.',
  { handle: z.string().describe('Twitter/X handle of the company (without @)') },
  async ({ handle }) => result(await apiCall('GET', `/company/${encodeURIComponent(handle)}/founders`))
);

server.tool(
  'frontrun_company_signals',
  'Social signal analysis: buzz score, sentiment, notable mentions, and which of your tracked VCs follow this entity. 16 credits.',
  { handle: z.string().describe('Twitter/X handle (without @)') },
  async ({ handle }) => result(await apiCall('GET', `/company/${encodeURIComponent(handle)}/signals`))
);

server.tool(
  'frontrun_company_resources',
  'Discovered links and resources: website, GitHub, docs, Discord, Telegram. Extracted from profile and website scrape. 60 credits.',
  { handle: z.string().describe('Twitter/X handle (without @)') },
  async ({ handle }) => result(await apiCall('GET', `/company/${encodeURIComponent(handle)}/resources`))
);

server.tool(
  'frontrun_company_funding',
  'Funding/deal info cross-referenced with VC follow signals. Returns round details, investors, and which of your tracked VCs follow them. 60 credits.',
  { handle: z.string().describe('Twitter/X handle (without @)') },
  async ({ handle }) => result(await apiCall('GET', `/company/${encodeURIComponent(handle)}/funding`))
);

// ============================================================
// VC INTELLIGENCE
// ============================================================

server.tool(
  'frontrun_vc_activity',
  'VC follow pattern analysis: velocity, sector distribution, recent follows with classification. 24 credits.',
  {
    handle: z.string().describe('Twitter/X handle of the tracked VC'),
    since: z.string().optional().describe('Time window. Default: "30d"'),
  },
  async ({ handle, since }) => result(await apiCall('GET', `/vc/${encodeURIComponent(handle)}/activity${buildQS({ since })}`))
);

server.tool(
  'frontrun_vc_similar',
  'Find VCs with similar follow patterns. Computed from temporal follow graph overlap — not raw follower lists. Use this to discover related investors. 60 credits.',
  {
    handle: z.string().describe('Twitter/X handle of the tracked VC'),
    min_overlap: z.number().optional().describe('Minimum overlap score (0-1). Default: 0.1'),
    limit: z.number().optional().describe('Max results (max 50). Default: 20'),
  },
  async ({ handle, min_overlap, limit }) => result(await apiCall('GET', `/vc/${encodeURIComponent(handle)}/similar${buildQS({ min_overlap, limit })}`))
);

// ============================================================
// FEED & DISCOVERY
// ============================================================

server.tool(
  'frontrun_feed',
  'Real-time activity feed across tracked accounts. "Who has my tracked list followed today?" Filter by event type (new_follow, convergence) and sector. 16 credits.',
  {
    event_type: z.string().optional().describe('Filter: "new_follow" or "convergence"'),
    since: z.string().optional().describe('Time window. Default: "24h"'),
    hours: z.number().optional().describe('Shorthand: hours to look back'),
    sector: z.string().optional().describe('Filter targets by sector'),
    limit: z.number().optional().describe('Max events (max 200). Default: 50'),
  },
  async ({ event_type, since, hours, sector, limit }) => {
    const params = {};
    if (event_type) params.event_type = event_type;
    if (since) params.since = since;
    else if (hours) params.hours = hours;
    if (sector) params.sector = sector;
    if (limit) params.limit = limit;
    return result(await apiCall('GET', `/feed${buildQS(params)}`));
  }
);

server.tool(
  'frontrun_sectors',
  'Sector breakdown of all discovered entities across your tracked accounts. Shows distribution with counts and percentages. 4 credits.',
  {},
  async () => result(await apiCall('GET', '/sectors'))
);

server.tool(
  'frontrun_discover',
  'Personalized account recommendations based on your tracked set and custom classification rules. "You track 50 VCs — here are accounts they follow that you\'re not tracking yet." 60 credits.',
  {
    sector: z.string().optional().describe('Narrow by sector'),
    min_signal: z.number().optional().describe('Minimum signal score (0-1). Default: 0.3'),
    limit: z.number().optional().describe('Max results (max 50). Default: 20'),
  },
  async ({ sector, min_signal, limit }) => result(await apiCall('GET', `/discover${buildQS({ sector, min_signal, limit })}`))
);

server.tool(
  'frontrun_reports',
  'Historical daily reports — the companies discovered in your daily email reports. Filter by date range and sector. "Show me last week\'s stablecoin discoveries." 4 credits.',
  {
    since: z.string().optional().describe('Time range: "7d", "14d", "30d", or "YYYY-MM-DD". Default: "7d"'),
    date: z.string().optional().describe('Specific date: "YYYY-MM-DD"'),
    sector: z.string().optional().describe('Filter by sector keyword (e.g. "stablecoin", "DeFi", "AI")'),
    limit: z.number().optional().describe('Max reports to return (max 30). Default: 7'),
  },
  async ({ since, date, sector, limit }) => result(await apiCall('GET', `/reports${buildQS({ since, date, sector, limit })}`))
);

// ============================================================
// WEBHOOKS
// ============================================================

server.tool(
  'frontrun_list_webhooks',
  'List your registered webhooks with status and last delivery time. Free.',
  {},
  async () => result(await apiCall('GET', '/webhooks'))
);

server.tool(
  'frontrun_create_webhook',
  'Register a webhook to receive push notifications for signal events (new_follows, convergence). Deliveries are signed with your secret if provided. 40 credits setup + 8 credits per delivery.',
  {
    url: z.string().describe('HTTPS endpoint to receive event payloads'),
    events: z.array(z.enum(['new_follows', 'convergence'])).describe('Event types to subscribe to'),
    filters: z.object({
      tracked_accounts: z.array(z.string()).optional().describe('Only deliver events from these tracked accounts'),
      sectors: z.array(z.string()).optional().describe('Only deliver events for targets in these sectors'),
      entity_types: z.array(z.string()).optional().describe('Only deliver events for these entity types (e.g. "company", "fund")'),
      is_company_only: z.boolean().optional().describe('Only deliver events for companies'),
      min_convergence: z.number().optional().describe('Convergence only: minimum tracked accounts following. Default: 2'),
    }).optional().describe('Optional event filters (AND logic)'),
    secret: z.string().optional().describe('Secret used to HMAC-sign delivery payloads'),
  },
  async ({ url, events, filters, secret }) => {
    const body = { url, events };
    if (filters) body.filters = filters;
    if (secret) body.secret = secret;
    return result(await apiCall('POST', '/webhooks', body));
  }
);

server.tool(
  'frontrun_delete_webhook',
  'Delete a registered webhook. Free.',
  { id: z.string().describe('Webhook ID to delete') },
  async ({ id }) => result(await apiCall('DELETE', `/webhooks/${encodeURIComponent(id)}`))
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
