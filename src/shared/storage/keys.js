// localStorage key registry — versioned per Build Rule 3. v2.1 keys
// preserved unchanged so Phase 2.0 reads existing user data.

export const K = {
  // CW (contract worker)
  cwEmp:    'sep_cw_emp_v2',
  cwAtt:    'sep_cw_att_v2',
  cwCfg:    'sep_cw_cfg_v2',
  cwPay:    'sep_cw_pay_v2',
  cwAdv:    'sep_cw_adv_v1',
  // Perm (permanent staff)
  peEmp:    'sep_pe_emp_v1',
  peAtt:    'sep_pe_att_v1',
  pePay:    'sep_pe_pay_v1',
  peAdv:    'sep_pe_adv_v1',
  // Stock
  stock:    'sep_stock_v1',
  stockLog: 'sep_stock_log_v1',
  // Production
  prodLog:   'sep_prod_log_v1',
  prodAreas: 'sep_prod_areas_v1',
  prodCfg:   'sep_prod_cfg_v1',
  permSnack: 'sep_perm_snack_log_v1',
  // System
  settings: 'sep_settings_v1',
  version:  'sep_data_version',
  // Month lock
  monthLock: 'sep_month_lock_v1',
  // Invoice
  clients:  'sep_clients_v1',
  rates:    'sep_rates_v1',
  invoices: 'sep_inv_v1',
  invCfg:   'sep_inv_cfg_v1',
};
