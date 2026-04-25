import type { Dialog, Page } from '@playwright/test';

export type DialogScript = Array<{
  /** Sanity-marker; not enforced (Playwright dialog.type() returns 'alert'|'confirm'|'prompt'|'beforeunload'). */
  expectType: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
  /** Substring expected in the dialog message; case-insensitive. Mismatches are recorded into `seen[]` for assertion. */
  matches?: string;
  /** For prompt: the response string. For confirm/alert: ignored. */
  reply?: string;
  /** Confirm dialogs: true = accept (OK), false = dismiss (Cancel). Default true. */
  accept?: boolean;
}>;

/**
 * Drive a sequence of native dialogs (alert/confirm/prompt) in order; capture
 * each one's text into `seen[]` for post-hoc assertion. Originally lived in
 * validation_inv.spec.ts (dash-3-2a, PR #8); extracted for dash-3-2b reuse
 * per Aurelius's "attachDialogScript extraction blessed" handoff at PR #8 merge.
 *
 * Use `expectType` for documentation only — Playwright's Dialog API doesn't
 * gate by type, so a script step's expectType is informational. The `matches`
 * substring is the binding check.
 */
export function attachDialogScript(page: Page, script: DialogScript): { seen: string[] } {
  const seen: string[] = [];
  let idx = 0;
  page.on('dialog', async (d: Dialog) => {
    const step = script[idx++];
    seen.push(`${d.type()}: ${d.message()}`);
    if (!step) {
      await d.dismiss().catch(() => {});
      return;
    }
    if (step.matches) {
      const ok = d.message().toLowerCase().includes(step.matches.toLowerCase());
      if (!ok) {
        seen.push(`!! mismatch at step ${idx - 1}: expected "${step.matches}"`);
      }
    }
    if (d.type() === 'prompt') {
      await d.accept(step.reply ?? '');
    } else if (step.accept === false) {
      await d.dismiss();
    } else {
      await d.accept();
    }
  });
  return { seen };
}
