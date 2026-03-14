# Frontrun MCP Server

Give AI agents native access to the [Frontrun](https://frontrun.vc) API. Track what VCs follow on X in real time — detect new follows, convergence signals, and trending companies across your monitored set.

Works with any MCP-compatible client: Claude Code, Claude Desktop, Cursor, Windsurf, and more.

## Setup

### Step 1: Get your API key

Sign up at [frontrun.vc](https://frontrun.vc) → Settings → API Keys.

### Step 2: Connect

**Claude Code** (one command):

```bash
claude mcp add frontrun -e FRONTRUN_API_KEY=your_api_key --scope user -- npx frontrun-mcp-server
```

Done. Start Claude Code and ask: *"What's trending in VC follows this week?"*

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "frontrun": {
      "command": "npx",
      "args": ["frontrun-mcp-server"],
      "env": {
        "FRONTRUN_API_KEY": "your_api_key"
      }
    }
  }
}
```

**Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "frontrun": {
      "command": "npx",
      "args": ["frontrun-mcp-server"],
      "env": {
        "FRONTRUN_API_KEY": "your_api_key"
      }
    }
  }
}
```

## Available tools

| Tool | Description |
|------|-------------|
| `frontrun_status` | Account status, balance, usage stats |
| `frontrun_list_tracked` | List all monitored accounts |
| `frontrun_track` | Start monitoring an X account |
| `frontrun_untrack` | Stop monitoring an X account |
| `frontrun_new_follows` | Detect new follows across tracked accounts |
| `frontrun_snapshot` | Get current follow list for an account |
| `frontrun_convergence` | Detect multi-account convergence signals |
| `frontrun_trending` | Get trending entities by follower count |
| `frontrun_account_activity` | Activity profile for a tracked account |
| `frontrun_search` | Search entities by sector, keyword, or type |
| `frontrun_enriched_follows` | New follows with full enrichment |
| `frontrun_classify` | Run classification on specific entities |
| `frontrun_create_rule` | Create custom classification rules |
| `frontrun_list_rules` | List classification rules |
| `frontrun_update_rule` | Update a classification rule |
| `frontrun_delete_rule` | Delete a classification rule |
| `frontrun_tag` | Add custom tags/notes to entities |
| `frontrun_list_tags` | List your custom-tagged entities |

## Example prompts

- *"What are the trending companies this week?"*
- *"Show me convergence signals with threshold 3 in the last 14 days"*
- *"What new accounts did pmarca follow in the last 48 hours?"*
- *"Search for AI/ML startups in the follow graph"*
- *"Track @sequoia"*

## Troubleshooting

**"FRONTRUN_API_KEY environment variable is required"** — Your API key isn't set. Check your config.

**"Invalid API key"** — Key is wrong or inactive. Generate a new one at frontrun.vc → Settings → API Keys.

**npx not found** — Install Node.js 18+ from [nodejs.org](https://nodejs.org).

## Documentation

Full API docs at [frontrun.vc/docs](https://frontrun.vc/docs)

## Source

[github.com/jongall45/frontrun-mcp-server](https://github.com/jongall45/frontrun-mcp-server)

## License

MIT
