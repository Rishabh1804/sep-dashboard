#!/bin/bash
# pdf-preview.sh — render a PDF to PNGs so they can be opened with the Read
# tool and actually LOOKED at.
#
#   .claude/hooks/pdf-preview.sh <file.pdf> [outdir] [dpi] [first] [last]
#
# Prints the PNG paths it wrote, one per line. Prefers poppler's pdftoppm;
# falls back to PyMuPDF so this still works when apt was unavailable.
#
# Why this exists: Phase 2 ships a printed job slip (SESSION_12_DESIGN_LOCK
# section 8) and a quality certificate after it, and a print artifact is the
# one surface no e2e assertion covers — Playwright can assert the DOM and
# still miss a slip that breaks across a page boundary. Render it and look.
# Also serves the sibling soma-internal repo's generated reports when both
# are open in one session.
set -euo pipefail

PDF="${1:?usage: pdf-preview.sh <file.pdf> [outdir] [dpi] [first] [last]}"
OUT="${2:-${TMPDIR:-/tmp}/pdf-preview}"
DPI="${3:-110}"
FIRST="${4:-}"
LAST="${5:-}"

[ -f "$PDF" ] || { echo "no such file: $PDF" >&2; exit 1; }
mkdir -p "$OUT"
BASE="$OUT/$(basename "${PDF%.*}")"

if command -v pdftoppm >/dev/null 2>&1; then
  args=(-png -r "$DPI")
  [ -n "$FIRST" ] && args+=(-f "$FIRST")
  [ -n "$LAST" ]  && args+=(-l "$LAST")
  pdftoppm "${args[@]}" "$PDF" "$BASE"
else
  python3 - "$PDF" "$BASE" "$DPI" "${FIRST:-1}" "${LAST:-0}" <<'PY'
import sys
try:
    import pymupdf
except ImportError:          # older wheels only expose the legacy name
    import fitz as pymupdf
pdf, base, dpi, first, last = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
doc = pymupdf.open(pdf)
last = last or doc.page_count
for i in range(first - 1, min(last, doc.page_count)):
    doc[i].get_pixmap(dpi=dpi).save(f"{base}-{i+1}.png")
PY
fi

ls -1 "$BASE"-*.png
