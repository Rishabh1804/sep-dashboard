// src/shared/utils/date.js
function localDateStr(d) {
  const dt = d ? new Date(d) : /* @__PURE__ */ new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function formatDate(dateStr) {
  return (/* @__PURE__ */ new Date(dateStr + "T00:00:00")).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}
function formatDateShort(dateStr) {
  return (/* @__PURE__ */ new Date(dateStr + "T00:00:00")).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });
}
function tnow() {
  return (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}
function isSunday(dateStr) {
  return (/* @__PURE__ */ new Date(dateStr + "T00:00:00")).getDay() === 0;
}
function getWeekEnd(dateStr) {
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? 6 : 6 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

// src/shared/config/app.js
var APP_VERSION = "2.1.0-alpha.1";

export {
  localDateStr,
  formatDate,
  formatDateShort,
  tnow,
  isSunday,
  getWeekEnd,
  APP_VERSION
};
//# sourceMappingURL=chunk-D5KUF7LV.js.map
