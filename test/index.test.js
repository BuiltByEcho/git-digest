import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { digest, toMarkdown, toCompact } from "../src/index.js";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Use the git-digest project itself as a test repo
const testCwd = dirname(dirname(fileURLToPath(import.meta.url)));

describe("digest", () => {
  it("returns a structured object with expected keys", () => {
    const d = digest(testCwd);
    assert.ok(d.branch, "branch is present");
    assert.ok(d.headHash, "headHash is present");
    assert.ok(d.status, "status is present");
    assert.ok(d.generatedAt, "generatedAt is present");
    assert.equal(typeof d.status.state, "string");
    assert.ok(Array.isArray(d.recentCommits));
  });

  it("detects the current branch", () => {
    const d = digest(testCwd);
    // Should match a valid branch name pattern
    assert.match(d.branch, /^[\w./-]+$/);
  });

  it("detects working tree status", () => {
    const d = digest(testCwd);
    assert.ok(["clean", "dirty", "unknown"].includes(d.status.state));
  });

  it("returns recent commits with structure", () => {
    const d = digest(testCwd, { commits: 3 });
    // If this is a fresh repo with no commits, recentCommits will be empty
    if (d.recentCommits.length > 0) {
      assert.ok(d.recentCommits[0].hash, "commit has hash");
      assert.ok(d.recentCommits[0].subject, "commit has subject");
      assert.ok(d.recentCommits[0].author, "commit has author");
      assert.ok(Array.isArray(d.recentCommits[0].files));
    }
  });

  it("respects commits option", () => {
    const d = digest(testCwd, { commits: 2 });
    if (d.recentCommits.length > 0) {
      assert.ok(d.recentCommits.length <= 2, "respects commit count limit");
    }
  });

  it("returns hotspots as array", () => {
    const d = digest(testCwd);
    assert.ok(Array.isArray(d.hotspots));
  });

  it("returns stashCount as number", () => {
    const d = digest(testCwd);
    assert.equal(typeof d.stashCount, "number");
  });

  it("returns contributors with count", () => {
    const d = digest(testCwd);
    assert.equal(typeof d.contributors.count, "number");
    assert.ok(Array.isArray(d.contributors.top));
  });

  it("skips PRs when includePRs is false", () => {
    const d = digest(testCwd, { includePRs: false });
    assert.equal(d.openPRs, null);
  });

  it("handles ahead/behind gracefully for missing base", () => {
    const d = digest(testCwd, { baseBranch: "nonexistent-branch-xyz" });
    // Should not throw; ahead/behind may be null
    assert.ok(d.aheadBehind);
  });
});

describe("toMarkdown", () => {
  it("produces markdown output", () => {
    const d = digest(testCwd);
    const md = toMarkdown(d);
    assert.ok(md.startsWith("# Git Digest:"), "starts with heading");
    assert.ok(md.includes("Recent Commits"), "has commits section");
  });

  it("includes status info for dirty repos", () => {
    const d = digest(testCwd);
    if (d.status.state === "dirty") {
      const md = toMarkdown(d);
      assert.ok(md.includes("staged") || md.includes("unstaged"), "shows change counts");
    }
  });
});

describe("toCompact", () => {
  it("produces a single-line compact summary", () => {
    const d = digest(testCwd);
    const compact = toCompact(d);
    assert.ok(compact.includes("branch="), "has branch");
    assert.ok(compact.includes("status="), "has status");
    assert.ok(!compact.includes("\n"), "single line");
  });
});

describe("CLI smoke test", () => {
  it("runs without error in default markdown mode", () => {
    const output = execFileSync(process.execPath, ["src/cli.js", testCwd], {
      cwd: testCwd,
      encoding: "utf8",
    });
    assert.ok(output.includes("Git Digest"), "markdown output contains heading");
  });

  it("produces valid JSON in json mode", () => {
    const output = execFileSync(process.execPath, ["src/cli.js", testCwd, "--format", "json"], {
      cwd: testCwd,
      encoding: "utf8",
    });
    const parsed = JSON.parse(output);
    assert.ok(parsed.branch, "parsed JSON has branch");
    assert.ok(parsed.recentCommits, "parsed JSON has recentCommits");
  });

  it("produces compact single-line output", () => {
    const output = execFileSync(process.execPath, ["src/cli.js", testCwd, "--format", "compact"], {
      cwd: testCwd,
      encoding: "utf8",
    }).trim();
    assert.ok(output.includes("branch="), "compact has branch");
    assert.ok(!output.includes("\n"), "compact is single line");
  });

  it("respects --commits flag", () => {
    const output = execFileSync(process.execPath, ["src/cli.js", testCwd, "--format", "json", "--commits", "2"], {
      cwd: testCwd,
      encoding: "utf8",
    });
    const parsed = JSON.parse(output);
    if (parsed.recentCommits.length > 0) {
      assert.ok(parsed.recentCommits.length <= 2, "respects commit count");
    }
  });
});
