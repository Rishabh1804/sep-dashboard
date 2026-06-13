// Job status vocabulary — Layer 1, dependency-free on purpose: the handler's
// Firebase chunk imports OPEN_JOB_STATUSES and must not drag zod in with it
// (schemas.js consumes JOB_STATUSES for its z.enum instead).
export const JOB_STATUSES = ['in-flight', 'ready', 'dispatched'];

// "Still on the floor" — consumed by the handler's job-picker query
// (firebase-boot.js) and the Live tab's overdue query (live.js). When the
// status model grows (rework / on-hold per the Session 11 route model),
// this is the ONE place the open-set definition changes.
export const OPEN_JOB_STATUSES = ['in-flight', 'ready'];
