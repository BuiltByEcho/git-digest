/**
 * @builtbyecho/git-digest — Core library
 * Produces concise, structured git repository summaries for AI agents and developers.
 */

import { execSync } from "node:child_process";

/**
 * Run a git command and return trimmed stdout. Returns null on failure.
 */
function git(cmd, cwd) {
  try {
    return execSync(`git ${cmd}`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Get current branch name.
 */
function getBranch(cwd) {
  return git("rev-parse --abbrev-ref HEAD", cwd);
}

/**
 * Get current commit hash (short).
 */
function getHeadHash(cwd) {
  return git("rev-parse --short HEAD", cwd);
}

/**
 * Get working tree status: "clean" or "dirty" with counts.
 */
function getStatus(cwd) {
  try {
    const raw = execSync("git status --porcelain", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trimEnd();
    return parsePorcelainStatus(raw);
  } catch {
    return parsePorcelainStatus(null);
  }
}

export function parsePorcelainStatus(raw) {
  if (raw === null) return { state: "unknown", files: [] };
  if (raw === "") return { state: "clean", files: [] };

  const lines = raw.split("\n").filter(Boolean);
  let staged = 0, unstaged = 0, untracked = 0;
  const files = lines.map((line) => {
    const x = line[0], y = line[1];
    if (x !== " " && x !== "?") staged++;
    if (y !== " " && y !== "?") unstaged++;
    if (x === "?" && y === "?") untracked++;

    const rawPath = line.slice(3);
    const [from, renamedPath] = rawPath.includes(" -> ") ? rawPath.split(" -> ") : [null, rawPath];
    const code = x === "?" && y === "?" ? "?" : y !== " " ? y : x;
    const status = code === "?" ? "untracked"
      : code === "A" ? "added"
        : code === "D" ? "deleted"
          : code === "R" ? "renamed"
            : code === "C" ? "copied"
              : "modified";
    return from ? { path: renamedPath, status, from } : { path: renamedPath, status };
  });

  return { state: "dirty", staged, unstaged, untracked, total: lines.length, files };
}

/**
 * Get ahead/behind counts relative to a base branch.
 */
function getAheadBehind(cwd, base = "main") {
  const result = git(`rev-list --left-right --count ${base}...HEAD`, cwd);
  if (!result) return { base, ahead: null, behind: null };
  const [behind, ahead] = result.split("\t").map(Number);
  return { base, ahead, behind };
}

/**
 * Get recent commits with file change summaries.
 */
function getRecentCommits(cwd, count = 10) {
  const raw = git(
    `log --pretty=format:%H%x00%s%x00%an%x00%ar --no-merges -n ${count}`,
    cwd
  );
  if (!raw) return [];

  const commits = raw.split("\n").map((line) => {
    const [hash, subject, author, relativeDate] = line.split("\0");
    const short = hash.slice(0, 7);
    return { hash: short, subject, author, relativeDate };
  });

  // Get changed files for each commit
  for (const commit of commits) {
    const diff = git(`diff-tree --no-commit-id --name-only -r ${commit.hash}`, cwd);
    commit.files = diff ? diff.split("\n").filter(Boolean) : [];
  }

  return commits;
}

/**
 * Get change hotspots — files most frequently changed in recent history.
 */
function getHotspots(cwd, days = 14, limit = 10) {
  const raw = git(
    `log --since="${days} days ago" --no-merges --pretty=format: --name-only`,
    cwd
  );
  if (!raw) return [];

  const freq = {};
  for (const file of raw.split("\n")) {
    const trimmed = file.trim();
    if (!trimmed) continue;
    freq[trimmed] = (freq[trimmed] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([file, changes]) => ({ file, changes }));
}

/**
 * Get stashes count.
 */
function getStashCount(cwd) {
  const raw = git("stash list", cwd);
  if (!raw) return 0;
  return raw.split("\n").filter(Boolean).length;
}

/**
 * Get remote URL (first remote found).
 */
function getRemote(cwd) {
  const remotes = git("remote", cwd);
  if (!remotes) return null;
  const first = remotes.split("\n")[0].trim();
  const url = git(`remote get-url ${first}`, cwd);
  return { name: first, url };
}

/**
 * Get last tag and distance from HEAD.
 */
function getLastTag(cwd) {
  const tag = git("describe --tags --abbrev=0", cwd);
  if (!tag) return null;
  const dist = git(`rev-list ${tag}..HEAD --count`, cwd);
  return { tag, commitsAhead: dist ? Number(dist) : null };
}

/**
 * Check for open PRs via GitHub CLI.
 */
function getOpenPRs(cwd) {
  try {
    const raw = execSync("gh pr list --state open --json number,title,author,createdAt", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const prs = JSON.parse(raw);
    return prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.author?.login || pr.author,
      createdAt: pr.createdAt,
    }));
  } catch {
    return null; // gh not available or not a GitHub repo
  }
}

/**
 * Get contributor count in last N days.
 */
function getContributors(cwd, days = 30) {
  const raw = git(`shortlog -sn --since="${days} days ago" HEAD`, cwd);
  if (!raw) return { count: 0, top: [] };
  const entries = raw.split("\n").filter(Boolean).map((line) => {
    const count = parseInt(line.trim().split("\t")[0], 10);
    const name = line.trim().split("\t")[1];
    return { name, commits: count };
  });
  return { count: entries.length, top: entries.slice(0, 5) };
}

/**
 * Generate a full digest of the repository.
 */
export function digest(cwd = process.cwd(), options = {}) {
  const {
    commits = 10,
    hotspotDays = 14,
    hotspotLimit = 10,
    baseBranch = "main",
    includePRs = true,
  } = options;

  const branch = getBranch(cwd);
  const headHash = getHeadHash(cwd);
  const status = getStatus(cwd);
  const aheadBehind = getAheadBehind(cwd, baseBranch);
  const recentCommits = getRecentCommits(cwd, commits);
  const hotspots = getHotspots(cwd, hotspotDays, hotspotLimit);
  const stashCount = getStashCount(cwd);
  const remote = getRemote(cwd);
  const lastTag = getLastTag(cwd);
  const contributors = getContributors(cwd);
  const openPRs = includePRs ? getOpenPRs(cwd) : null;

  return {
    branch,
    headHash,
    status,
    aheadBehind,
    recentCommits,
    hotspots,
    stashCount,
    remote,
    lastTag,
    contributors,
    openPRs,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format a digest as human-readable Markdown.
 */
export function toMarkdown(d) {
  const lines = [];

  lines.push(`# Git Digest: ${d.branch}`);
  lines.push("");
  lines.push(`**Head:** \`${d.headHash}\` · **Status:** ${d.status.state === "clean" ? "✅ clean" : "⚠️ dirty"} · **Stashes:** ${d.stashCount}`);

  if (d.aheadBehind.ahead !== null || d.aheadBehind.behind !== null) {
    lines.push(`**vs ${d.aheadBehind.base}:** ahead ${d.aheadBehind.ahead ?? "?"} · behind ${d.aheadBehind.behind ?? "?"}`);
  }

  if (d.lastTag) {
    lines.push(`**Last tag:** ${d.lastTag.tag} (${d.lastTag.commitsAhead} commits behind HEAD)`);
  }

  if (d.remote) {
    lines.push(`**Remote:** ${d.remote.name} → ${d.remote.url}`);
  }

  if (d.status.state === "dirty") {
    lines.push(`**Changes:** ${d.status.staged} staged · ${d.status.unstaged} unstaged · ${d.status.untracked} untracked`);
    if (d.status.files?.length) {
      lines.push("");
      lines.push("## Working Tree Changes");
      lines.push("");
      for (const file of d.status.files.slice(0, 20)) {
        lines.push(`- ${file.path} — ${file.status}${file.from ? ` from ${file.from}` : ""}`);
      }
      if (d.status.files.length > 20) lines.push(`- ... ${d.status.files.length - 20} more`);
    }
  }

  lines.push("");
  lines.push(`## Recent Commits`);
  lines.push("");
  for (const c of d.recentCommits) {
    const fileSummary = c.files.length > 0 ? ` (${c.files.length} file${c.files.length > 1 ? "s" : ""})` : "";
    lines.push(`- \`${c.hash}\` ${c.subject} — _${c.author}_ ${c.relativeDate}${fileSummary}`);
  }

  if (d.hotspots.length > 0) {
    lines.push("");
    lines.push(`## Change Hotspots (last ${d.hotspotDays ?? 14} days)`);
    lines.push("");
    for (const h of d.hotspots) {
      lines.push(`- \`${h.file}\` — ${h.changes} change${h.changes > 1 ? "s" : ""}`);
    }
  }

  if (d.contributors.count > 0) {
    lines.push("");
    lines.push(`## Contributors (last 30 days: ${d.contributors.count})`);
    lines.push("");
    for (const c of d.contributors.top) {
      lines.push(`- ${c.name} (${c.commits})`);
    }
  }

  if (d.openPRs && d.openPRs.length > 0) {
    lines.push("");
    lines.push(`## Open PRs (${d.openPRs.length})`);
    lines.push("");
    for (const pr of d.openPRs) {
      lines.push(`- #${pr.number} ${pr.title} — _${pr.author}_`);
    }
  } else if (d.openPRs !== null && d.openPRs.length === 0) {
    lines.push("");
    lines.push("## Open PRs: none");
  }

  return lines.join("\n");
}

/**
 * Format a digest as compact plain text (good for agents).
 */
export function toCompact(d) {
  const parts = [];
  parts.push(`branch=${d.branch} head=${d.headHash} status=${d.status.state}`);
  if (d.status.state === "dirty") {
    parts.push(`changes=${d.status.staged}staged/${d.status.unstaged}unstaged/${d.status.untracked}untracked`);
  }
  if (d.aheadBehind.ahead !== null) {
    parts.push(`vs-${d.aheadBehind.base}=ahead${d.aheadBehind.ahead}/behind${d.aheadBehind.behind}`);
  }
  if (d.lastTag) {
    parts.push(`tag=${d.lastTag.tag}+${d.lastTag.commitsAhead}`);
  }
  parts.push(`stashes=${d.stashCount}`);
  parts.push(`commits=${d.recentCommits.length}`);
  if (d.hotspots.length > 0) {
    parts.push(`hotspots=${d.hotspots.map((h) => h.file).join(",")}`);
  }
  return parts.join(" | ");
}
