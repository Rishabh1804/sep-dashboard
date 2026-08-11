#!/bin/bash
set -euo pipefail

# Reconcile the browser build if the sandbox ships a different one.
# Some environments pre-install Chromium at a build number this Playwright
# version does not expect, and disable downloading the matching one. Rather than
# fight that, point the config at the browser that IS present.
# playwright.config.ts reads PW_CHROMIUM_PATH and ignores it when unset, so this
# is a no-op wherever Playwright's own resolution already works.
# Ported from sep-invoicing 11 Aug 2026 — without it the 41-case e2e suite is
# simply unrunnable in a web session, which is how it was found.
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -d node_modules ]; then
  expected=$(node -e "try{console.log(require('@playwright/test').chromium.executablePath())}catch(e){}" 2>/dev/null || true)
  fallback="${PLAYWRIGHT_BROWSERS_PATH:-}/chromium"
  if [ -n "$expected" ] && [ ! -x "$expected" ] && [ -x "$fallback" ]; then
    echo "export PW_CHROMIUM_PATH=$fallback" >> "$CLAUDE_ENV_FILE"
    echo "Playwright: expected browser missing, using $fallback" >&2
  fi
fi

# PDF tooling for Claude Code on the web.
# Only needed in the remote (web) container; no-op on local machines.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Phase 2 ships print artifacts — the job slip in 2.0, the quality certificate
# in 2.1 (docs/SESSION_12_DESIGN_LOCK.md section 8). A print artifact is the one
# surface the Playwright suite cannot cover: it can assert the DOM and still
# miss a slip that breaks across a page boundary or a station stamp clipped at
# the margin. This installs a renderer so a generated PDF can be rasterised and
# actually looked at.
#
# poppler-utils gives pdftoppm/pdftocairo (fast, best fidelity). PyMuPDF is the
# pure-python fallback with no system deps, so a session still has a renderer if
# apt is unavailable or offline. Both non-fatal: a failure here must never block
# session start, and neither is required to build or test the bundles.
if ! command -v pdftoppm >/dev/null 2>&1; then
  (apt-get install -y -qq poppler-utils >/dev/null 2>&1) || true
fi
if ! python3 -c "import pymupdf" 2>/dev/null && ! python3 -c "import fitz" 2>/dev/null; then
  python3 -m pip install --user --quiet pymupdf || true
fi

exit 0
