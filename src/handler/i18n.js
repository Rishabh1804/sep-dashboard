// Handler i18n — Devanagari (Hindi) primary, English secondary.
//
// Phase 7 BLOCKER fix: i18n is not deferred work. Every worker-facing
// string ships with a Hindi label day-one; English is the toggle. Pure
// data + pure lookups so it unit-tests without a browser. TTS (long-press
// to hear the label) layers on via Web Speech API with feature detection.

const LANG_KEY = 'sep_handler_lang';
export const LANGS = ['hi', 'en'];

// Every key carries both languages. The unit test asserts completeness,
// so a missing translation fails CI rather than silently falling back.
export const DICT = {
  // App / shell
  app_title:        { hi: 'एसईपी हैंडलर',        en: 'SEP Handler' },
  home:             { hi: 'होम',                  en: 'Home' },
  recent_entries:   { hi: 'हाल की एंट्री',         en: 'Recent entries' },
  no_recent:        { hi: 'अभी कोई एंट्री नहीं',   en: 'No entries yet' },
  settings:         { hi: 'सेटिंग',               en: 'Settings' },
  language:         { hi: 'भाषा',                  en: 'Language' },
  sound:            { hi: 'आवाज़',                 en: 'Sound' },
  handler_name:     { hi: 'आपका नाम',             en: 'Your name' },
  shift:            { hi: 'शिफ्ट',                 en: 'Shift' },
  shift_m:          { hi: 'सुबह',                  en: 'Morning' },
  shift_s:          { hi: 'दिन',                   en: 'Standard' },
  shift_e:          { hi: 'शाम',                   en: 'Evening' },

  // Sync chip / queue
  synced:           { hi: 'सब सेव हो गया',         en: 'All synced' },
  syncing:          { hi: 'भेज रहे हैं',           en: 'Syncing' },
  offline_saved:    { hi: 'फ़ोन में सेव, अभी भेजा नहीं', en: 'Saved on phone, not yet sent' },
  not_sent:         { hi: 'भेजा नहीं',                 en: 'Not sent' },
  rejected:         { hi: 'सर्वर ने मना किया',     en: 'Rejected by server' },
  sync_status:      { hi: 'सिंक स्थिति',           en: 'Sync status' },
  sync_now:         { hi: 'अभी भेजें',             en: 'Sync now' },
  hold:             { hi: 'रुकें',                 en: 'Hold' },
  review:           { hi: 'देखें',                 en: 'Review' },
  last_sync:        { hi: 'पिछली बार भेजा',        en: 'Last sync' },
  network:          { hi: 'नेटवर्क',               en: 'Network' },
  online:           { hi: 'चालू',                  en: 'online' },
  offline:          { hi: 'बंद',                   en: 'offline' },
  pending_sync:     { hi: 'भेजना बाकी',            en: 'pending sync' },
  pending_since:    { hi: 'कब से',                 en: 'Since' },

  // Form names (tiles)
  job_receipt:      { hi: 'माल आया',               en: 'Job receipt' },
  production:       { hi: 'प्रोडक्शन',             en: 'Production' },
  dft:              { hi: 'डीएफटी माप',            en: 'DFT measure' },
  dispatch:         { hi: 'माल भेजा',              en: 'Dispatch' },
  stock_refill:     { hi: 'स्टॉक आया',             en: 'Stock refill' },
  stock_deplete:    { hi: 'स्टॉक खर्च',            en: 'Stock used' },
  machine_state:    { hi: 'मशीन स्थिति',           en: 'Machine state' },
  check_in:         { hi: 'हाज़िरी',               en: 'Check in/out' },
  note:             { hi: 'नोट',                   en: 'Note' },

  // Field labels
  f_job:            { hi: 'जॉब',                   en: 'Job' },
  f_machine:        { hi: 'मशीन',                  en: 'Machine' },
  f_worker:         { hi: 'कारीगर',                en: 'Worker' },
  f_quantity:       { hi: 'मात्रा',                en: 'Quantity' },
  f_station:        { hi: 'स्टेशन',                en: 'Station' },
  f_notes:          { hi: 'नोट (वैकल्पिक)',        en: 'Notes (optional)' },
  f_customer:       { hi: 'ग्राहक',                en: 'Customer' },
  f_weight:         { hi: 'वज़न (किग्रा)',         en: 'Weight (kg)' },
  f_dft_micron:     { hi: 'डीएफटी (माइक्रोन)',     en: 'DFT (micron)' },
  f_item:           { hi: 'सामान',                 en: 'Item' },
  f_supplier:       { hi: 'सप्लायर',               en: 'Supplier' },
  f_cost:           { hi: 'कीमत (₹)',              en: 'Cost (₹)' },
  f_state:          { hi: 'स्थिति',                en: 'State' },
  f_direction:      { hi: 'आना/जाना',              en: 'In / Out' },
  f_note_text:      { hi: 'क्या लिखना है',         en: 'What to note' },
  f_note_kind:      { hi: 'किस बारे में',          en: 'About' },
  f_self:           { hi: 'खुद',                   en: 'self' },

  // Station / state option values
  opt_pickling:     { hi: 'पिकलिंग',              en: 'Pickling' },
  opt_plating:      { hi: 'प्लेटिंग',             en: 'Plating' },
  opt_passivation:  { hi: 'पैसिवेशन',             en: 'Passivation' },
  opt_inspection:   { hi: 'जाँच',                 en: 'Inspection' },
  opt_running:      { hi: 'चालू',                 en: 'Running' },
  opt_idle:         { hi: 'खाली',                 en: 'Idle' },
  opt_down:         { hi: 'खराब',                 en: 'Down' },
  opt_in:           { hi: 'आना',                  en: 'In' },
  opt_out:          { hi: 'जाना',                 en: 'Out' },

  // Actions / dialogs
  back:             { hi: 'वापस',                  en: 'Back' },
  cancel:           { hi: 'रद्द करें',             en: 'Cancel' },
  submit_continue:  { hi: 'सेव करें और आगे',       en: 'Submit & continue' },
  submit_return:    { hi: 'सेव करें',              en: 'Submit' },
  change:           { hi: 'बदलें',                 en: 'Change' },
  choose:           { hi: 'चुनें',                 en: 'Choose…' },
  search_more:      { hi: 'और खोजें',              en: 'Search more' },
  saved:            { hi: 'सेव हो गया',            en: 'Saved' },
  required:         { hi: 'यह ज़रूरी है',          en: 'This is required' },
  resume_q:         { hi: 'पिछली एंट्री जारी रखें?', en: 'Resume previous entry?' },
  yes:              { hi: 'हाँ',                   en: 'Yes' },
  no:               { hi: 'नहीं',                  en: 'No' },
  still_same:       { hi: 'अब भी यही?',            en: 'Still this?' },
  stage_d_note:     { hi: 'पूरे फ़ील्ड स्टेज D में आएँगे', en: 'Full fields land in Stage D' },
};

let current = readInitialLang();

function readInitialLang() {
  try {
    const saved = globalThis.localStorage?.getItem(LANG_KEY);
    if (saved && LANGS.includes(saved)) return saved;
  } catch { /* no localStorage */ }
  return 'hi';
}

export function getLang() { return current; }

export function setLang(lang) {
  if (!LANGS.includes(lang)) return current;
  current = lang;
  try { globalThis.localStorage?.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  return current;
}

// Pure lookup: current language → English → raw key. Never throws.
export function t(key, lang = current) {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en ?? key;
}

// Long-press a field label to hear it (Phase 7 TTS lock). Best-effort:
// feature-detected, prefers a Hindi voice, silent no-op where unsupported.
export function speak(key) {
  const synth = globalThis.speechSynthesis;
  if (!synth || typeof globalThis.SpeechSynthesisUtterance === 'undefined') return false;
  const text = t(key, 'hi');
  const u = new globalThis.SpeechSynthesisUtterance(text);
  u.lang = 'hi-IN';
  const hindiVoice = synth.getVoices?.().find((v) => v.lang?.startsWith('hi'));
  if (hindiVoice) u.voice = hindiVoice;
  synth.cancel();
  synth.speak(u);
  return true;
}
