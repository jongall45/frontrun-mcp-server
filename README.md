# Frontrun MCP Server

Give AI agents native access to the [Frontrun](https://frontrun.vc) API. Track what VCs follow on X in real time — detect new follows, convergence signals, and trending companies across your monitored set.

Works with any MCP-compatible client: Claude Code, Claude Desktop, Cursor, Windsurf, and more.

## Quick start

```bash
npx frontrun-mcp-server
```

Requires a Frontrun API key. Get one at [frontrun.vc](https://frontrun.vc) → Settings → API Keys.

## Configuration

### Claude Code

Add to your project's `.mcp.json`:

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

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

### Cursor

Add to `.cursor/mcp.json` in your project:

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

Once configured, ask your agent:

- "What are the trending companies this week?"
- "Show me convergence signals with threshold 3 in the last 14 days"
- "What new accounts did pmarca follow in the last 48 hours?"
- "Search for AI/ML startups in the follow graph"
- "Track @sequoia"

## Documentation

Full API docs at [frontrun.vc/docs](https://frontrun.vc/docs)

## License

MIT
