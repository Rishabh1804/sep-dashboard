#!/bin/bash
set -euo pipefail

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
