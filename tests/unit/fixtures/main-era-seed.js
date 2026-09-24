// What a device first booted on the pre-alpha.9 `main` build holds in
// localStorage: that build's DEF_PERM / DEF_CW / DEF_CFG. The STRUCTURE (ids,
// names, roles, which tier each worker sat in) is verbatim from that build; every
// RATE is replaced with an invented value (101, 102, … per worker; hourRate 11,
// snackRate 7, OT cap 123), because this repo ships no pay data. What the tests
// need from it is that the rates are present and are not the imported ones.
// A .js module, not .json: this repo gitignores *.json so a data export can
// never be committed.
export const MAIN_ERA = {
  "perm": [
    {
      "id": "shyam_bera",
      "name": "Shyam",
      "role": "Production Supervisor",
      "dailyRate": 101,
      "inactive": false
    },
    {
      "id": "sharat_mahato",
      "name": "Sharat",
      "role": "VAT A1 Lead",
      "dailyRate": 102,
      "inactive": false
    },
    {
      "id": "sunil_mahato",
      "name": "Sunil",
      "role": "Barrel Lead",
      "dailyRate": 103,
      "inactive": false
    },
    {
      "id": "rupa_bera",
      "name": "Rupa",
      "role": "VAT A2 Lead",
      "dailyRate": 104,
      "inactive": false
    },
    {
      "id": "bp_sharma",
      "name": "Bhanu",
      "role": "Worker",
      "dailyRate": 105,
      "inactive": false
    },
    {
      "id": "lk_das",
      "name": "Lucky",
      "role": "Worker",
      "dailyRate": 106,
      "inactive": false
    },
    {
      "id": "lal",
      "name": "Lal",
      "role": "Worker",
      "dailyRate": 107,
      "inactive": false
    },
    {
      "id": "suklal",
      "name": "Suklal",
      "role": "Pickling Lead",
      "dailyRate": 108,
      "inactive": false
    },
    {
      "id": "uday",
      "name": "Uday",
      "role": "Guard",
      "dailyRate": 109,
      "inactive": false
    },
    {
      "id": "rounak",
      "name": "Rounak",
      "role": "Data Admin",
      "dailyRate": 110,
      "inactive": true
    }
  ],
  "cw": [
    {
      "id": "kusu",
      "name": "Kusu",
      "inactive": false
    },
    {
      "id": "sripati",
      "name": "Sripati",
      "inactive": false
    },
    {
      "id": "naren",
      "name": "Naren",
      "inactive": false
    },
    {
      "id": "champai",
      "name": "Champai",
      "inactive": false
    },
    {
      "id": "budheswar",
      "name": "Budheswar",
      "inactive": false
    },
    {
      "id": "sai",
      "name": "Sai",
      "inactive": false
    },
    {
      "id": "shambhu",
      "name": "Shambhu",
      "inactive": false
    },
    {
      "id": "mantu",
      "name": "Mantu",
      "inactive": false
    },
    {
      "id": "rocky",
      "name": "Rocky",
      "inactive": false
    },
    {
      "id": "birsa",
      "name": "Birsa",
      "inactive": false
    },
    {
      "id": "tuklu",
      "name": "Tuklu",
      "inactive": false
    }
  ],
  "cfg": {
    "hourRate": 11,
    "snackRate": 7,
    "permOtMultiplier": 1.1,
    "permOtBaseRate": 123,
    "guardIds": [
      "uday"
    ],
    "excludedIds": [
      "rounak"
    ],
    "standardShift": {
      "start": "08:30",
      "end": "17:00",
      "hours": 8
    },
    "sundayHolidayShift": {
      "start": "06:00",
      "end": "14:00",
      "hours": 8
    },
    "morningOT": {
      "start": "06:00",
      "end": "08:30",
      "hours": 3
    },
    "eveningOT": {
      "start": "17:00",
      "end": "20:00",
      "hours": 3
    }
  }
};
