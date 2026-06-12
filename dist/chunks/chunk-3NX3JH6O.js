// src/shared/utils/event-time.js
function eventMillis(doc) {
  const t = doc?.created_at;
  if (t && typeof t.toMillis === "function") return t.toMillis();
  if (typeof t === "string") {
    const ms = Date.parse(t);
    if (!Number.isNaN(ms)) return ms;
  }
  return typeof doc?.client_ts === "number" ? doc.client_ts : 0;
}

// src/shared/types/job-status.js
var OPEN_JOB_STATUSES = ["in-flight", "ready"];

export {
  eventMillis,
  OPEN_JOB_STATUSES
};
//# sourceMappingURL=chunk-3NX3JH6O.js.map
