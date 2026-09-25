#!/usr/bin/env bash
# Pull live upstream data so this skill's version-sensitive facts are never stale.
#
#   ./scripts/refresh.sh              # versions + plugin compatibility (fast, ~5s)
#   ./scripts/refresh.sh --docs       # also mirror canonical doc sources to $OUT
#   ./scripts/refresh.sh --docs-only
#
# Needs network access to registry.npmjs.org and raw.githubusercontent.com.
# If either is blocked, say so and fall back to the bundled references/ files,
# telling the user those are a snapshot dated in SKILL.md.

set -uo pipefail
OUT="${OUT:-/tmp/starlight-upstream}"
MODE="${1:-}"

hr() { printf '%s\n' "----------------------------------------------------------------"; }

# ---------------------------------------------------------------- local project
local_versions() {
  hr; echo "INSTALLED (from ./package.json)"; hr
  if [ -f package.json ]; then
    python3 - <<'PY'
import json
d = json.load(open('package.json'))
deps = {**d.get('dependencies', {}), **d.get('devDependencies', {})}
keys = [k for k in deps if 'astro' in k or 'starlight' in k or 'expressive-code' in k]
if not keys:
    print("  no Astro/Starlight deps found — is this the docs site root?")
for k in sorted(keys):
    print(f"  {k:52s} {deps[k]}")
PY
  else
    echo "  no package.json here. cd to the docs site root and re-run."
  fi
}

# ------------------------------------------------------- upstream latest + peer
plugins() {
  hr; echo "UPSTREAM LATEST + COMPATIBILITY"; hr
  echo "  Verdict key: OK = declares Astro 7 / Starlight >=0.41, or depends on"
  echo "  @astrojs/markdown-satteri.  CHECK = installs but never declared Astro 7."
  echo "  DEAD = excludes Astro 7; do not use."
  echo
  for p in astro @astrojs/starlight @astrojs/markdown-satteri astro-expressive-code \
           starlight-llms-txt starlight-page-actions starlight-llm-actions \
           starlight-page-context-action starlight-dot-md starlight-md-txt \
           starlight-openapi starlight-links-validator starlight-package-managers \
           starlight-mcp starlight-agentready starlight-contextual-menu \
           @expressive-code/plugin-collapsible-sections @expressive-code/plugin-line-numbers; do
    curl -sf --max-time 12 "https://registry.npmjs.org/${p//\//%2f}" 2>/dev/null | python3 -c "
import sys, json
try: d = json.load(sys.stdin)
except Exception: print('  ??      unreachable      $p'); raise SystemExit
if 'dist-tags' not in d: print('  ??      not on npm      $p'); raise SystemExit
lv = d['dist-tags']['latest']; v = d['versions'][lv]
pub = d.get('time', {}).get(lv, '?')[:10]
peer = v.get('peerDependencies', {}) or {}
alldeps = {**peer, **(v.get('dependencies', {}) or {})}
astro, sl = peer.get('astro', ''), peer.get('@astrojs/starlight', '')
satteri = any('markdown-satteri' in k for k in alldeps)
if satteri or '7' in astro.replace('>=4','').replace('>=5','') or (sl and sl >= '>=0.41'):
    verdict = 'OK'
elif astro.startswith('^5') and '7' not in astro:
    verdict = 'DEAD'
elif astro.startswith('^5') or astro.startswith('^6'):
    verdict = 'DEAD'
else:
    verdict = 'CHECK'
if '$p' in ('astro','@astrojs/starlight','@astrojs/markdown-satteri','astro-expressive-code') or '$p'.startswith('@expressive-code/'):
    verdict = '--'  # first-party / in-family: versioned with core, not independently pinned
print(f'  {verdict:7s} {lv:10s} {pub}  $p')
if peer: print(f'          peer: {json.dumps(peer)}')
"
  done
  echo
  echo "  DEAD entries are not judgement calls — an excluding peer range means the"
  echo "  package will not install cleanly on the current stack. Pick the"
  echo "  replacement named in references/llm-friendly.md."
}

# --------------------------------------------------------------- doc mirroring
docs() {
  hr; echo "MIRRORING CANONICAL DOC SOURCES -> $OUT"; hr
  mkdir -p "$OUT/starlight/components" "$OUT/starlight/reference" \
           "$OUT/starlight/guides" "$OUT/starlight/resources" "$OUT/expressive-code"
  SL=https://raw.githubusercontent.com/withastro/starlight/main/docs/src/content/docs
  EC=https://raw.githubusercontent.com/expressive-code/expressive-code/main/docs/src/content/docs
  get() { curl -sf --max-time 15 "$1" -o "$2" && echo "  ok   ${2#$OUT/}" || echo "  MISS ${1##*/} (path may have moved upstream)"; }

  for f in asides badges card-grids cards code file-tree icons link-buttons \
           link-cards steps tabs using-components; do
    get "$SL/components/$f.mdx" "$OUT/starlight/components/$f.mdx"
  done
  get "$SL/reference/frontmatter.md"        "$OUT/starlight/reference/frontmatter.md"
  get "$SL/reference/configuration.mdx"     "$OUT/starlight/reference/configuration.mdx"
  get "$SL/guides/authoring-content.mdx"    "$OUT/starlight/guides/authoring-content.mdx"
  get "$SL/resources/plugins.mdx"           "$OUT/starlight/resources/plugins.mdx"
  get "https://raw.githubusercontent.com/withastro/starlight/main/packages/starlight/CHANGELOG.md" \
      "$OUT/starlight/CHANGELOG.md"
  get "https://raw.githubusercontent.com/withastro/docs/main/src/content/docs/en/guides/markdown-content.mdx" \
      "$OUT/starlight/astro-markdown-content.mdx"

  for f in key-features/text-markers key-features/frames key-features/word-wrap \
           key-features/code-component key-features/syntax-highlighting \
           plugins/collapsible-sections plugins/line-numbers reference/configuration; do
    get "$EC/$f.mdx" "$OUT/expressive-code/$(basename $f).mdx"
  done

  echo
  echo "  These are the authoritative sources, in Markdown, no HTML scraping."
  echo "  Read from $OUT in preference to references/ whenever they disagree."
}

case "$MODE" in
  --docs-only) docs ;;
  --docs)      local_versions; plugins; docs ;;
  *)           local_versions; plugins
               echo; echo "  Run with --docs to also mirror upstream doc sources." ;;
esac
