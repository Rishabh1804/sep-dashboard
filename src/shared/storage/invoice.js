import { loadJSON } from './storage.js';
import { K } from './keys.js';
import { DEF_INV_CFG } from '../config/invoice.js';
import { getState } from './state.js';

export function getClients()  { return loadJSON(K.clients, []); }
export function getRates()    { return loadJSON(K.rates, []); }
export function getInvoices() { return loadJSON(K.invoices, []); }
export function getInvCfg()   { return { ...DEF_INV_CFG, ...loadJSON(K.invCfg, {}) }; }

export function getClientRates(clientId) {
  return getRates().filter((r) => r.clientId === clientId);
}

// India FY runs Apr→Mar; numbering resets each FY ("YYYY-YY").
export function getFY(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const y = d.getFullYear(); const m = d.getMonth();
  const fy1 = m >= 3 ? y : y - 1;
  return `${fy1}-${String(fy1 + 1).slice(-2)}`;
}

export function genInvNumber() {
  const cfg = getInvCfg();
  const fy = getFY(getState().today);
  const num = String(cfg.nextNumber).padStart(4, '0');
  return `${cfg.seriesPrefix}/${fy}/${num}`;
}
