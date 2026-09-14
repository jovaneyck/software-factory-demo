#!/usr/bin/env node
// factory-pr-body.js — Deterministically assemble the final PR body from the
// artifacts that are ACTUALLY COMMITTED on the branch (ground truth), so the
// feature-owner LLM can never silently drop screenshots or the C4 diff again.
//
// It does three things the LLM used to do by hand (and kept getting wrong):
//   1. Rewrites the ## Screenshots section into commit-pinned, rendered image
//      links — enumerating the screenshots that are really committed under
//      artifacts/screenshots/ (NOT trusting the worker's often-wrong paths/names).
//   2. Splices the C4 component diff (artifacts/diff.component.md) into an
//      ## Architecture Changes section, between Summary and Test Output.
//   3. Writes the result to a file for `gh pr create/edit --body-file`.
//
// Usage:
//   node factory-pr-body.js --worktree <path> --sha <sha> --repo <owner/repo> \
//        [--body <artifacts/pr-body.md>] [--diff <artifacts/diff.component.md>] \
//        [--out <path>]
//
// Exit codes: 0 ok (prints OUT path + a summary to stderr); non-zero on hard error.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const worktree = arg('worktree');
const sha = arg('sha');
const repo = arg('repo');
if (!worktree || !sha || !repo) {
  console.error('usage: factory-pr-body.js --worktree <path> --sha <sha> --repo <owner/repo> [--body ..] [--diff ..] [--out ..]');
  process.exit(2);
}
const bodyPath = path.resolve(worktree, arg('body', 'artifacts/pr-body.md'));
const diffPath = path.resolve(worktree, arg('diff', 'artifacts/diff.component.md'));
const outPath = arg('out', path.join(require('os').tmpdir(), `pr-body-${sha.slice(0, 8)}.md`));

if (!fs.existsSync(bodyPath)) {
  console.error(`ERROR: pr-body not found at ${bodyPath}`);
  process.exit(1);
}
let body = fs.readFileSync(bodyPath, 'utf8').replace(/\r\n/g, '\n');

// --- ground truth: which screenshots are actually committed on the branch? ---
function committedScreenshots() {
  try {
    const out = execFileSync('git', ['-C', worktree, 'ls-files', 'artifacts/screenshots/'], { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim())
      .filter((s) => /\.(png|jpe?g|gif|webp)$/i.test(s));
  } catch {
    return [];
  }
}
const shots = committedScreenshots();

// Parse caption hints from the existing ## Screenshots section (best-effort).
// Lines look like: `artifacts/screenshots/foo.png — caption` or `screenshots/foo.png - caption`.
// Map committed-file basename -> caption, by matching the basename the worker
// referenced (its path may be wrong, but the filename usually isn't). We do NOT
// do positional matching: a wrong-order/short list would mislabel screens, which
// is worse than an honest humanized filename.
function parseCaptions(section) {
  const map = {};       // basename -> caption
  for (const raw of section.split('\n')) {
    const line = raw.trim();
    if (!line || /^N\/?A\b/i.test(line)) continue;
    const m = line.match(/([\w./-]+\.(?:png|jpe?g|gif|webp))\s*[—:-]\s*(.+)$/i);
    if (m) map[path.basename(m[1])] = m[2].trim();
  }
  return map;
}

function rawUrl(file) {
  return `https://github.com/${repo}/blob/${sha}/${file}?raw=true`;
}

// --- rewrite the ## Screenshots section from the committed files ---
const shotHeader = /(^|\n)(#{1,6}\s*Screenshots\s*\n)([\s\S]*?)(?=\n#{1,6}\s|\n*$)/i;
if (shots.length > 0) {
  const m = body.match(shotHeader);
  const map = m ? parseCaptions(m[3]) : {};
  const lines = shots.map((file) => {
    const base = path.basename(file);
    const caption = map[base] ||
      base.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    return `![${caption}](${rawUrl(file)})`;
  });
  const block = `\n## Screenshots\n\n${lines.join('\n\n')}\n`;
  if (m) {
    body = body.replace(shotHeader, (full, pre) => `${pre === '\n' ? '\n' : ''}${block.trimStart()}\n`);
  } else {
    body = body.trimEnd() + '\n\n' + block.trimStart();
  }
  console.error(`screenshots: embedded ${shots.length} committed image(s): ${shots.map((s) => path.basename(s)).join(', ')}`);
} else {
  console.error('screenshots: none committed under artifacts/screenshots/ (leaving section as-is)');
}

// --- splice the C4 diff between Summary and Test Output ---
if (fs.existsSync(diffPath)) {
  let diff = fs.readFileSync(diffPath, 'utf8').replace(/\r\n/g, '\n').trim();
  // demote a leading top-level "# ..." title to fit under our ## section
  diff = diff.replace(/^#\s+/, '### ');
  const section = `\n## Architecture Changes (C4 component diff)\n\n${diff}\n`;
  if (/##\s*Architecture Changes/i.test(body)) {
    body = body.replace(/\n##\s*Architecture Changes[\s\S]*?(?=\n#{1,6}\s|\n*$)/i, section);
    console.error('architecture: replaced existing C4 diff section');
  } else if (/\n#{1,6}\s*Test Output/i.test(body)) {
    body = body.replace(/\n(#{1,6}\s*Test Output)/i, `${section}\n$1`);
    console.error('architecture: spliced C4 diff before Test Output');
  } else {
    body = body.trimEnd() + '\n' + section;
    console.error('architecture: appended C4 diff (no Test Output anchor found)');
  }
} else {
  console.error(`architecture: no diff at ${diffPath} (skipping C4 section)`);
}

fs.writeFileSync(outPath, body.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf8');
console.error(`wrote PR body -> ${outPath}`);
process.stdout.write(outPath + '\n');
