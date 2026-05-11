#!/usr/bin/env node

/**
 * @builtbyecho/git-digest — CLI entry point
 * Usage: git-digest [path] [--format json|markdown|compact] [--commits N] [--hotspot-days N] [--base BRANCH] [--no-prs]
 */

import { digest, toMarkdown, toCompact } from "./index.js";

const args = process.argv.slice(2);

function usage() {
  console.log(`
git-digest — Concise git repository summaries for AI agents and developers

Usage:
  git-digest [path] [options]

Options:
  --format <json|markdown|compact>  Output format (default: markdown)
  --commits <n>                     Number of recent commits (default: 10)
  --hotspot-days <n>               Days to analyze for hotspots (default: 14)
  --hotspot-limit <n>              Max hotspot files to show (default: 10)
  --base <branch>                  Base branch for ahead/behind (default: main)
  --no-prs                         Skip GitHub PR lookup
  --help                           Show this help

Examples:
  git-digest                         # Markdown summary of current repo
  git-digest --format json           # JSON output for programmatic use
  git-digest ../other-repo           # Digest a different repo
  git-digest --format compact        # Single-line compact summary
  git-digest --base develop --commits 5
`.trim());
}

// Parse args
let path = ".";
let format = "markdown";
let commits = 10;
let hotspotDays = 14;
let hotspotLimit = 10;
let baseBranch = "main";
let includePRs = true;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--help" || arg === "-h") { usage(); process.exit(0); }
  if (arg === "--format" && args[i + 1]) { format = args[++i]; continue; }
  if (arg === "--commits" && args[i + 1]) { commits = parseInt(args[++i], 10); continue; }
  if (arg === "--hotspot-days" && args[i + 1]) { hotspotDays = parseInt(args[++i], 10); continue; }
  if (arg === "--hotspot-limit" && args[i + 1]) { hotspotLimit = parseInt(args[++i], 10); continue; }
  if (arg === "--base" && args[i + 1]) { baseBranch = args[++i]; continue; }
  if (arg === "--no-prs") { includePRs = false; continue; }
  if (!arg.startsWith("--")) { path = arg; }
}

try {
  const d = digest(path, { commits, hotspotDays, hotspotLimit, baseBranch, includePRs });

  switch (format) {
    case "json":
      console.log(JSON.stringify(d, null, 2));
      break;
    case "compact":
      console.log(toCompact(d));
      break;
    case "markdown":
    default:
      console.log(toMarkdown(d));
      break;
  }
} catch (err) {
  console.error(`git-digest error: ${err.message}`);
  process.exit(1);
}
