// Big-button picker grid (Phase 7 HIGH fix: typeahead is the wrong
// primitive for gloved hands). High-frequency fields — job, machine,
// worker — open a bottom sheet of ≥120×80px cards, recent-first, with a
// typeahead box only as a fallback for the long tail. Cards come from a
// local cache so the picker never depends on the network.

import { t } from './i18n.js';

// item: { id, primary, sub?, tier?, method? }
// Returns a close() handle; resolves selection via onPick(item).
export function openPicker({ titleKey, items, onPick }) {
  if (typeof document === 'undefined') return () => {};
  const overlay = document.createElement('div');
  overlay.className = 'h-sheet-overlay';
  const close = () => overlay.remove();

  overlay.innerHTML = `<div class="h-sheet" role="dialog" aria-modal="true">
    <div class="h-sheet-head">
      <div class="h-sheet-title">${t(titleKey)}</div>
      <button class="h-sheet-close" aria-label="${t('cancel')}">✕</button>
    </div>
    <input class="h-picker-search" type="search" inputmode="search"
           placeholder="${t('search_more')}…" aria-label="${t('search_more')}">
    <div class="h-sheet-body"><div class="h-picker-grid"></div></div>
  </div>`;

  const grid = overlay.querySelector('.h-picker-grid');
  const search = overlay.querySelector('.h-picker-search');

  const render = (list) => {
    grid.innerHTML = '';
    for (const it of list) {
      const card = document.createElement('button');
      card.className = 'h-pcard';
      card.dataset.id = it.id;
      if (it.tier) card.dataset.tier = it.tier;
      card.innerHTML = `
        <span class="h-pcard-primary">${it.primary}</span>
        ${it.sub ? `<span class="h-pcard-sub">${it.sub}</span>` : ''}
        ${(it.tier || it.method) ? `<span class="h-pcard-tags">
          ${it.tier ? `<span class="h-tag">${it.tier}</span>` : ''}
          ${it.method ? `<span class="h-tag">${it.method}</span>` : ''}
        </span>` : ''}`;
      card.addEventListener('click', () => { onPick(it); close(); });
      grid.appendChild(card);
    }
    if (!list.length) grid.innerHTML = `<div class="h-empty">${t('no_recent')}</div>`;
  };

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    render(!q ? items : items.filter((it) =>
      `${it.primary} ${it.sub || ''} ${it.id}`.toLowerCase().includes(q)));
  });

  overlay.querySelector('.h-sheet-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  render(items);
  document.body.appendChild(overlay);
  return close;
}
