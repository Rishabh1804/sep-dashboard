// Floating action button + speed-dial menu. Action handlers
// (markAllPresent, addProdNote, toggleHoliday) live in the tab modules
// they belong to and are wired in dashboard/main via window globals.

let fabOpen = false;

export function toggleFab() {
  fabOpen = !fabOpen;
  document.getElementById('fabBtn')?.classList.toggle('open', fabOpen);
  document.getElementById('fabMenu')?.classList.toggle('open', fabOpen);
}

export function closeFab() {
  fabOpen = false;
  document.getElementById('fabBtn')?.classList.remove('open');
  document.getElementById('fabMenu')?.classList.remove('open');
}

export function initFab(actions) {
  // Click-outside dismissal.
  document.addEventListener('click', (e) => {
    if (fabOpen && !e.target.closest('.fab-container')) closeFab();
  });
  // Expose fabAction as a closure that reaches into the registered map.
  return function fabAction(action) {
    closeFab();
    const fn = actions[action];
    if (typeof fn === 'function') fn();
  };
}
