import { loadJSON } from './storage.js';
import { K } from './keys.js';
import { DEF_STOCK } from '../config/stock.js';

export function getStock()    { return loadJSON(K.stock, DEF_STOCK); }
export function getStockLog() { return loadJSON(K.stockLog, []); }
