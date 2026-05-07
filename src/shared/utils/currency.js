// Currency rounding (Build Rule 5: paisa floored, never rounded up).
export function sepRound(n) { return Math.floor(Number(n) || 0); }

export function formatCurrency(n) {
  return '₹' + sepRound(n).toLocaleString('en-IN');
}
