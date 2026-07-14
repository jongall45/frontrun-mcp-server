# Frontrun MCP Server

VC follow intelligence for AI agents. Track what top investors follow on X — detect new follows, convergence signals, and trending companies before they're announced.

33 tools. Version 2.5.2.

## Setup (1 minute)

### Option A: OAuth login (recommended)

No API key needed. Log in with your frontrun.vc account:

```bash
# Step 1: Log in — opens browser, saves credentials locally
npx frontrun-mcp-server --login

# Step 2: Auto-configure your client
npx frontrun-mcp-server --setup         # Claude Desktop
npx frontrun-mcp-server --setup-code    # Claude Code (uses `claude mcp add`)
```

Credentials are saved to `~/.frontrun/credentials.json`. Other commands:

```bash
npx frontrun-mcp-server --status   # Check auth status
npx frontrun-mcp-server --logout   # Clear saved credentials
```

### Option B: Manual API key

If you prefer to use an API key directly, go to [frontrun.vc](https://frontrun.vc) → **Settings > API Keys** and generate a key (starts with `sig_`).

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add frontrun -e FRONTRUN_API_KEY=sig_your_key_here --scope user -- npx frontrun-mcp-server
```

Or add to `.mcp.json` in any project:

```json
{
  "mcpServers": {
    "frontrun": {
      "command": "npx",
      "args": ["frontrun-mcp-server"],
      "env": {
        "FRONTRUN_API_KEY": "sig_your_key_here"
      }
    }
  }
}
```
</details>

<details>
<summary><b>Claude Desktop</b></summary>

Add to your config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "frontrun": {
      "command": "npx",
      "args": ["frontrun-mcp-server"],
      "env": {
        "FRONTRUN_API_KEY": "sig_your_key_here"
      }
    }
  }
}
```
</details>

<details>
<summary><b>Cursor</b></summary>

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "frontrun": {
      "command": "npx",
      "args": ["frontrun-mcp-server"],
      "env": {
        "FRONTRUN_API_KEY": "sig_your_key_here"
      }
    }
  }
}
```
</details>

<details>
<summary><b>Any MCP-compatible client</b></summary>

```bash
FRONTRUN_API_KEY=sig_your_key_here npx frontrun-mcp-server
```
</details>

### Start asking questions

Open your AI tool and try:

> "What's trending in my tracked accounts this week?"

---

## What can I ask?

Here are real prompts that work out of the box. Just type them into Claude Code, Claude Desktop, or Cursor.

### Daily deal flow
- "What are the trending companies this week?"
- "Show me what my tracked VCs followed in the last 48 hours"
- "Any convergence signals? Who are multiple VCs following independently?"

### Deep research
- "Tell me everything about @hitdotone — who founded it, what they're building, and who's backing them"
- "Who are the founders of @someproject and what's their background?"
- "What funding has @tempofinance raised?"

### Discovery
- "Find me early-stage DeFi companies that my tracked VCs are following but I'm not tracking yet"
- "What sectors are getting the most attention from VCs right now?"
- "Search for stablecoin startups in the follow graph"

### Portfolio monitoring
- "Track @a16zcrypto and @paradigm"
- "Show me a16zcrypto's recent follow activity and what sectors they're focused on"
- "Find VCs with similar follow patterns to @multicoin"

### Custom intelligence
- "Create a rule to flag any stablecoin neobank companies"
- "Tag @hitdotone as a portfolio candidate"
- "Show me all entities matching my stablecoin rule from the last 7 days"

---

## How it works

Frontrun monitors the X (Twitter) follow graphs of VCs and investors you choose to track. When a VC follows a new account, Frontrun detects it, classifies the entity (startup, protocol, founder, etc.), and makes it queryable through AI.

**The signal:** VCs typically follow companies 2-8 weeks before a funding announcement. Convergence — multiple VCs independently following the same account — is the strongest signal.

**Receipts:** @techdollarhq flagged at 13 followers, $3M pre-seed announced 123 days later · @orthogonal_sh flagged 184 days before its $4.3M round led by Pantera · @rialto_xyz flagged at 18 followers, 26 days before its Robinhood partner announcement.

**What you're paying for:** Every response is computed intelligence, not raw data. Sectors are classified by AI, convergence is detected algorithmically, and company profiles are synthesized from multiple sources.

---

## Pricing

API + MCP access is included with the **Pro plan ($99/mo)** — it comes with 10,000 credits every month, and you can add more (or turn on auto-refill) at frontrun.vc/api/billing. Each query costs credits:

| What you're doing | Credits |
|---|---|
| Check your balance, list tracked accounts, manage rules/tags | Free |
| Preview an account, search, view sectors, pull a report | 4 |
| New follows, enriched follows, feed, company signals | 16 |
| Trending scan, VC activity | 24 |
| Thesis search, webhook setup (then 8/delivery) | 40 |
| Company deep-dive: overview, funding, convergence, resources, discover, similar VCs | 60 |
| Founder intelligence | 100 |

A typical daily check-in (feed + convergence + a few company deep-dives) runs ~300 credits — an included month covers it more than 30x over. Agent-scale usage is what auto-refill is for.

---

## All available tools

The agent has access to these tools automatically. You don't need to call them by name — just ask your question and the agent picks the right tool.

### Tracking
| Tool | What it does |
|---|---|
| `frontrun_status` | Your balance, tracked count, usage stats |
| `frontrun_list_tracked` | All accounts you're monitoring |
| `frontrun_track` | Start monitoring an X account |
| `frontrun_untrack` | Stop monitoring an account |
| `frontrun_preview` | Preview an account before tracking — signal score, sector hints, recommendation |

### Signals
| Tool | What it does |
|---|---|
| `frontrun_new_follows` | New follows detected across your tracked accounts |
| `frontrun_snapshot` | Current follow list for a specific tracked account |
| `frontrun_enriched_follows` | New follows + AI classification + custom rules applied |
| `frontrun_convergence` | Multiple tracked accounts following the same entity |
| `frontrun_trending` | Entities ranked by follow velocity |
| `frontrun_search` | Search discovered entities by sector, keyword, type |
| `frontrun_thesis_search` | Semantic search — describe a thesis in plain language, get matching companies |
| `frontrun_feed` | Real-time activity feed across all tracked accounts |
| `frontrun_sectors` | Sector breakdown of discovered entities |
| `frontrun_discover` | Personalized recommendations — "accounts your VCs follow that you're not tracking" |
| `frontrun_reports` | Generated intelligence reports for your tracked accounts |

### Company intelligence
| Tool | What it does |
|---|---|
| `frontrun_company` | Company overview — what they do, sector, stage |
| `frontrun_company_founders` | Founder profiles, backgrounds, previous companies |
| `frontrun_company_signals` | Social buzz, sentiment, notable engagements |
| `frontrun_company_resources` | Website, GitHub, docs, community links |
| `frontrun_company_funding` | Funding rounds, investors, amounts |

### VC intelligence
| Tool | What it does |
|---|---|
| `frontrun_vc_activity` | VC follow patterns — velocity, sector focus, recent follows |
| `frontrun_vc_similar` | Find VCs with overlapping follow patterns |

### Classification
| Tool | What it does |
|---|---|
| `frontrun_classify` | Run AI classification on specific entities |
| `frontrun_create_rule` | Create a custom classification rule |
| `frontrun_list_rules` | List your rules |
| `frontrun_update_rule` | Update a rule |
| `frontrun_delete_rule` | Delete a rule |
| `frontrun_tag` | Tag an entity with custom labels |
| `frontrun_list_tags` | List your tagged entities |

### Webhooks
| Tool | What it does |
|---|---|
| `frontrun_list_webhooks` | List your registered webhooks |
| `frontrun_create_webhook` | Register a webhook for new_follows / convergence events |
| `frontrun_delete_webhook` | Delete a webhook |

---

## REST API

Prefer HTTP? Every tool maps to a REST endpoint. Base URL: `https://frontrun.vc/v1`

```bash
# Set your key
export FR_KEY="sig_your_key_here"

# Check your account
curl -sL -H "X-API-Key: $FR_KEY" "https://frontrun.vc/v1/status"

# What's trending?
curl -sL -H "X-API-Key: $FR_KEY" "https://frontrun.vc/v1/trending?since=168h"

# Convergence signals
curl -sL -H "X-API-Key: $FR_KEY" "https://frontrun.vc/v1/convergence?since=168h"
```

Full REST docs: [frontrun.vc/docs/api](https://frontrun.vc/docs/api)

---

## Support

- Docs: [frontrun.vc/docs](https://frontrun.vc/docs)
- Issues: [github.com/jongall45/frontrun-mcp-server/issues](https://github.com/jongall45/frontrun-mcp-server/issues)

## License

MIT
