# @builtbyecho/git-digest

**Concise, structured git repository summaries for AI agents and developers.**

Get branch status, recent commits, change hotspots, and open PRs in a single command — formatted for humans, agents, or pipelines.

## Why?

Every time an AI agent starts working on a repository, it needs context: *what branch am I on? Is the tree clean? What changed recently? Which files are hotspots? Are there open PRs?* Parsing raw `git log` and `git status` output wastes tokens and is error-prone. `git-digest` gives you all of that in one structured, agent-friendly output.

## Fits in the Echo agent toolchain

Use `git-digest` before and after agent work. Before a task, it shows the current branch, dirty state, recent commits, hotspots, and open PRs. After a task, it gives a compact change receipt that pairs cleanly with `agent-runlog` output.

This is the repo-awareness layer for Echo builds: fast enough for local use, structured enough for automation, and readable enough for public build notes.

## Refresh smoke

```bash
npm test
npm run smoke
npm pack --dry-run --json
```

## Install

```bash
npm install -g @builtbyecho/git-digest
```

Or use directly:

```bash
npx @builtbyecho/git-digest
```

## Usage

### CLI

```bash
# Markdown summary (default)
git-digest

# JSON for programmatic use
git-digest --format json

# Compact single-line summary
git-digest --format compact

# Digest a different repo
git-digest /path/to/repo

# Customize output
git-digest --commits 5 --hotspot-days 30 --base develop --format json
```

### Options

| Option | Default | Description |
|---|---|---|
| `--format` | `markdown` | Output format: `json`, `markdown`, or `compact` |
| `--commits` | `10` | Number of recent commits to include |
| `--hotspot-days` | `14` | Days to analyze for change hotspots |
| `--hotspot-limit` | `10` | Max hotspot files to show |
| `--base` | `main` | Base branch for ahead/behind comparison |
| `--no-prs` | — | Skip GitHub PR lookup (via `gh` CLI) |

### Programmatic API

```js
import { digest, toMarkdown, toCompact } from "@builtbyecho/git-digest";

// Get structured digest
const d = digest("/path/to/repo", {
  commits: 10,
  hotspotDays: 14,
  hotspotLimit: 10,
  baseBranch: "main",
  includePRs: true,
});

// Format output
console.log(toMarkdown(d));  // Human/agent-readable markdown
console.log(toCompact(d));   // Single-line compact summary
console.log(JSON.stringify(d, null, 2)); // Raw JSON
```

### Digest Object

```json
{
  "branch": "main",
  "headHash": "a1b2c3d",
  "status": { "state": "clean" },
  "aheadBehind": { "base": "main", "ahead": 0, "behind": 0 },
  "recentCommits": [
    { "hash": "a1b2c3d", "subject": "Add feature X", "author": "dev", "relativeDate": "2 hours ago", "files": ["src/x.js"] }
  ],
  "hotspots": [
    { "file": "src/index.js", "changes": 12 }
  ],
  "stashCount": 0,
  "remote": { "name": "origin", "url": "https://github.com/org/repo.git" },
  "lastTag": { "tag": "v1.0.0", "commitsAhead": 5 },
  "contributors": { "count": 3, "top": [{ "name": "dev", "commits": 42 }] },
  "openPRs": [],
  "generatedAt": "2026-05-11T05:00:00.000Z"
}
```

### Output Examples

**Markdown:**
````markdown
# Git Digest: main

**Head:** `a1b2c3d` · **Status:** ✅ clean · **Stashes:** 0
**vs main:** ahead 0 · behind 0
**Last tag:** v1.0.0 (5 commits behind HEAD)
**Remote:** origin → https://github.com/org/repo.git

## Recent Commits

- `a1b2c3d` Add feature X — _dev_ 2 hours ago (3 files)
- `e4f5g6h` Fix bug Y — _dev_ 1 day ago (1 file)

## Change Hotspots (last 14 days)

- `src/index.js` — 12 changes
- `src/api.js` — 8 changes
````

**Compact:**
```
branch=main head=a1b2c3d status=clean | vs-main=ahead0/behind0 | tag=v1.0.0+5 | stashes=0 | commits=10 | hotspots=src/index.js,src/api.js
```

## Agent Integration Tips

- Use `--format json` for reliable programmatic parsing
- Use `--format compact` for context-constrained agents (single line, ~200 chars)
- Use `--no-prs` when `gh` CLI is unavailable or to avoid API rate limits
- Pipe output directly into agent context windows for instant repo awareness
- Run as a pre-task hook: agents can check if the tree is dirty before starting work

## Requirements

- Node.js 18+
- Git (in PATH)
- GitHub CLI (`gh`) — optional, for open PR data

## License

MIT © BuiltByEcho

## Release Automation

This package is published from GitHub Actions using npm Trusted Publishing with provenance. Releases are built on GitHub-hosted runners and no long-lived npm publish token is required.
