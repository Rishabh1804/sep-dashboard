# Canonical Schema Reference

**Phase:** 1-8 synthesis
**Status:** LIVE — 7 May 2026 (v1)
**Authority:** This is THE canonical entity reference. When TypeScript types or Zod schemas in code conflict with this document, this document is authoritative — fix the code or update this document with a new version entry.

Companion: [`../architecture/SCHEMA_MIGRATION.md`](../architecture/SCHEMA_MIGRATION.md) for evolution discipline; [`../architecture/SCHEMA_CHANGELOG.md`](../architecture/SCHEMA_CHANGELOG.md) for the change log.

---

## Conventions

- All entities carry `__schema_version: number` (Phase 6); v1 = current
- Every Firestore doc carries: `created_at: Timestamp` (server-set per Phase 4), `app_version: string` (build hash per Phase 3), `author_user_id: string` (= Firebase Auth UID per Phase 4)
- Common types: `Timestamp` = Firestore Timestamp; `UserRef = { uid: string; display_name: string }`
- Cross-collection references stored as foreign-key strings (entity IDs); not subdocuments
- Soft-delete via `deleted_at: Timestamp | null` field (per Phase 4); hard-delete admin-only

---

## Top-Level Collections

### `customers/{cid}`

```typescript
interface Customer {
  __schema_version: number;
  id: string;
  name: string;
  contact_info: {
    phone?: string;
    email?: string;
    address?: string;
    primary_contact_name?: string;
  };
  client_tier: 'tier-1' | 'tier-2' | 'default';
  default_quality_tier: 'premium' | 'standard';
  default_billing_unit: 'kg' | 'pcs';
  notes?: string;                          // free-text legacy; structured notes via /notes/
  health_score?: number;                    // 0-100; derived (Phase 5 event-sourced); Phase 2.1+ rendering
  sep_invoicing_customer_id?: string;       // FK to sep-invoicing app
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  deleted_at: Timestamp | null;
  last_applied_event_id_health?: string;    // Phase 5 idempotency
}
```

### `items/{iid}`

```typescript
interface Item {
  __schema_version: number;
  id: string;
  customer_id: string;                      // FK
  description: string;
  wpp_grams: number | null;                 // null until calibrated
  wpp_calibrated_at: Timestamp | null;
  default_plating_method: 'cyanide' | 'acid';
  hazmat_notes?: string;
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  deleted_at: Timestamp | null;
}
```

### `jobs/{jid}`

```typescript
interface Job {
  __schema_version: number;
  id: string;                               // format: J-{YYYY}-{nnnn}
  customer_id: string;                      // FK
  item_id: string;                          // FK
  invoice_id?: string;                      // FK to sep-invoicing
  received_kg: number;
  received_pcs?: number;                    // derivable from received_kg / wpp
  target_pcs?: number;                      // computed
  target_kg?: number;
  quality_tier_override?: 'premium' | 'standard';
  client_tier_at_receipt: 'tier-1' | 'tier-2' | 'default';   // snapshot
  current_priority_bump: number;            // derived (Phase 5 event-sourced from /priority_bump_events)
  current_status: 'in-flight' | 'ready' | 'dispatched';      // derived from /route_history
  current_location: { type: 'machine' | 'staging' | 'gate'; ref: string };  // derived
  route: 'standard' | 'rework-active' | 'rework-completed';
  received_at: Timestamp;
  ready_at?: Timestamp;
  dispatched_at?: Timestamp;
  sla_deadline_at: Timestamp;               // received_at + 24h
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  deleted_at: Timestamp | null;
  last_applied_event_id_routeHistory?: string;
  last_applied_event_id_priorityBump?: string;
}
```

### `workers/{wid}`

```typescript
interface Worker {
  __schema_version: number;
  id: string;                               // = Firebase Auth UID for handler-role workers
  name: string;
  monogram: string;                         // 1-2 letters
  role: 'full-time' | 'part-time' | 'notebook-handler' | 'guard';
  role_in_room?: 'plating-operator' | 'passivation-worker' | 'combined-operator'
              | 'pickler' | 'barrel-operator' | 'inspector'
              | 'floor-supervisor' | 'dispatch';
  home_area: 'area-1' | 'area-2' | 'area-3' | 'area-4' | 'office' | null;
  home_room_id?: string;                    // FK
  floatable: boolean;
  current_status: 'on-shift' | 'on-break' | 'off-shift' | 'in-transit';   // derived from /shifts
  current_location_room_id?: string;        // derived
  hire_date: Timestamp;
  mood_score?: number;                      // 0-100; derived; Phase 2.1+ rendering
  evaluation_notes?: string;                // private, gated to steward
  // Auth fields
  active_token_id: string;                  // Phase 8 rotation
  token_reissued_at?: Timestamp;
  revoked_at: Timestamp | null;             // Phase 4 immediate revocation
  provisioned_at?: Timestamp;
  // Audit
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  deleted_at: Timestamp | null;
  last_applied_event_id_shifts?: string;
  last_applied_event_id_mood?: string;
}
```

### `rooms/{rid}`

```typescript
interface Room {
  __schema_version: number;
  id: string;                               // 'vat-room-1' / 'barrel-room' / etc.
  name: string;
  type: 'plating-vat' | 'plating-barrel' | 'pickling' | 'support' | 'storage' | 'admin';
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  area: 'area-1' | 'area-2' | 'area-3' | 'area-4' | 'support';
  doors: Door[];
  internal_pathways: Pathway[];
  fg_strip_exterior_id?: string;
  rectifier_exterior_id?: string;
  staffing_complement: { role: string; count: number }[];
  current_status: 'operational' | 'partial' | 'down' | 'maintenance';
  // Audit
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  deleted_at: Timestamp | null;
}

interface Door {
  id: string;
  room_id: string;
  position_x: number;
  position_y: number;
  width: number;
  side: 'top' | 'bottom' | 'left' | 'right';
  perimeter_loop_segment_id: string;
}

interface Pathway {
  id: string;
  room_id: string;
  points: { x: number; y: number }[];
}
```

### `machines/{mid}`

```typescript
interface Machine {
  __schema_version: number;
  id: string;                               // 't-1-1' / 'st-1-1' / etc.
  name: string;
  area: 'area-1' | 'area-2' | 'area-3' | 'area-4';
  room_id: string;                          // FK
  type: 'plating-vat-cyanide' | 'staging-tank' | 'passivation-tank'
      | 'drum-rinse-dip' | 'rinse-dip-tank' | 'pickling-hcl'
      | 'pickling-dip-water' | 'plating-barrel-acid'
      | 'dryer-centrifugal-shared' | 'inspection-station';
  shared_bath_with?: string[];
  shared_resource?: boolean;
  shape: 'rectangle' | 'circle' | 'oval';
  state_kind: 'process' | 'capacity';
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  functional: boolean;                      // false for dysfunctional (e.g., T2)
  current_status: 'running' | 'idle' | 'down' | 'maintenance' | 'inspecting';   // derived
  current_capacity_kg?: number;             // derived; capacity-state machines
  capacity_max_kg?: number;
  default_cycle_time_min?: number;
  status_changed_at: Timestamp;
  health_score?: number;                    // derived; Phase 2.1+ rendering
  primary_operator_role?: string;
  // Audit
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  deleted_at: Timestamp | null;
  last_applied_event_id_stateTransitions?: string;
  last_applied_event_id_health?: string;
}
```

### `stock_items/{sid}`

```typescript
interface StockItem {
  __schema_version: number;
  id: string;
  name: string;
  category: 'plating-chemistry' | 'consumables' | 'office' | 'maintenance' | 'ppe' | 'utilities';
  tracking_mode: 'replenishment' | 'per-job-allocation';
  unit: 'kg' | 'L' | 'pcs' | 'units' | 'kWh';
  current_level: number;                    // derived from receipts - depletions
  threshold_low: number;
  threshold_critical: number;
  last_refill_at?: Timestamp;
  weighted_avg_unit_cost?: number;          // derived
  // Audit
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  deleted_at: Timestamp | null;
  last_applied_event_id_balance?: string;
}
```

### `suppliers/{sid}` (Phase 7 must-add)

```typescript
interface Supplier {
  __schema_version: number;
  id: string;
  name: string;
  contact: {
    phone?: string;
    email?: string;
    address?: string;
  };
  payment_terms?: string;
  delivery_history_summary?: string;        // Phase 2.1+ derived
  // Audit
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  deleted_at: Timestamp | null;
}
```

### `perimeter_segments/{psid}`

```typescript
interface PerimeterLoopSegment {
  __schema_version: number;
  id: string;
  points: { x: number; y: number }[];
  width_px: number;
  maintenance_state: 'green' | 'orange' | 'red';
  last_maintained_at?: Timestamp;
  next_due_at?: Timestamp;
  notes?: string;
  // Audit
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  deleted_at: Timestamp | null;
}
```

### `production_entries/{pid}`

```typescript
interface ProductionEntry {
  __schema_version: number;
  id: string;
  job_id: string;                           // FK
  machine_id: string;                       // FK
  worker_id: string;                        // FK
  qty_pcs?: number;
  qty_kg?: number;
  station: 'pickling' | 'plating' | 'inspection' | 'dispatch';
  recorded_by_app: 'dashboard' | 'handler' | 'pickler' | 'inspector' | 'dispatch';
  client_created_at: Timestamp;             // Phase 5 ordering
  // Common
  created_at: Timestamp;                    // = server_committed_at
  app_version: string;
  author_user_id: string;
  idempotency_key: string;                  // form-open UUID
  notes?: string;
}
```

### `dft_measurements/{mid}`

```typescript
interface DFTMeasurement {
  __schema_version: number;
  id: string;
  job_id: string;
  micron_value: number;                     // 0-50 hard-blocked
  measured_by: string;                      // = inspector worker_id
  measured_at: Timestamp;
  outcome: 'pass' | 'fail-rework';
  failure_mode?: 'low-dft' | 'high-dft' | 'finish-defect' | 'other';
  notes?: string;
  client_created_at: Timestamp;
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  idempotency_key: string;
}
```

### `dispatch_events/{eid}`

```typescript
interface DispatchEvent {
  __schema_version: number;
  id: string;
  job_id: string;
  customer_id: string;
  dispatched_by_user: string;
  dispatched_at: Timestamp;
  mode: '3-wheeler' | 'bike' | 'cycle' | 'hand' | 'other';
  vehicle_details?: string;
  invoice_id?: string;
  invoice_status: 'pending-check' | 'linked' | 'missing-alert-sent' | 'invoicing-down';
  customer_acknowledgment_at?: Timestamp;
  client_created_at: Timestamp;
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  idempotency_key: string;
}
```

### `audit_events/{aid}`

```typescript
interface AuditEvent {
  __schema_version: number;
  id: string;
  entity_type: 'job' | 'production-entry' | 'machine' | 'stock' | 'worker'
             | 'customer' | 'item' | 'dft-measurement' | 'dispatch-event'
             | 'note' | 'supplier' | 'room';
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'state-change'
        | 'edit-with-reason' | 'provision' | 'revoke_soft' | 'revoke_immediate'
        | 'token_reissue' | 'auth_exchange' | 'normalize' | 'migrate'
        | 'anomaly_detect' | 'anomaly_disposition';
  field_changed?: string;
  old_value?: any;
  new_value?: any;
  triggered_by_user: string;
  triggered_by_app: 'dashboard' | 'handler' | 'cf' | 'pickler' | 'inspector' | 'dispatch';
  recorded_at: Timestamp;
  app_version?: string;
  conflict_with_event_id?: string;          // for LWW conflict tracking
}
```

### `notes/{nid}` (top-level only, structured-mem schema)

See [`../architecture/STRUCTURED_NOTES.md`](../architecture/STRUCTURED_NOTES.md) for full detail.

```typescript
interface NoteRecord {
  __schema_version: number;
  id: string;
  topic_refs: TopicRef[];                   // array-contains queryable
  summary: string;                          // ≤120 chars
  body_md: string;
  kind?: string;                            // open discriminator
  data?: Record<string, unknown>;
  status: 'active' | 'resolved' | 'archived';
  priority?: 'normal' | 'urgent';
  expires_at?: Timestamp;
  tags: string[];
  links: NoteLink[];
  source: 'handler' | 'dashboard' | 'cf-anomaly' | 'cf-rule' | 'external';
  created_by: UserRef;
  created_at: Timestamp;
  app_version: string;
  revisions: Revision[];
  // For anomalies
  dispositioned_by?: UserRef;
  dispositioned_at?: Timestamp;
  disposition?: 'real-issue' | 'false-positive' | 'duplicate' | 'wont-fix';
}

interface TopicRef {
  entity_type: 'machine' | 'worker' | 'job' | 'customer' | 'stock' | 'room' | 'corridor' | 'inspection-station';
  entity_id: string;
}

interface Revision {
  at: Timestamp;
  by: UserRef;
  change: 'created' | 'updated' | 'resolved' | 'reopened' | 'archived' | 'priority-changed';
  body_diff?: string;
  resolution_note?: string;
  reason?: string;
}

interface NoteLink {
  to_note_id: string;
  type: 'supersedes' | 'caused-by' | 'related-to' | 'duplicate-of';
}
```

### `config/min_supported_build` (singleton config doc)

```typescript
interface MinSupportedBuildConfig {
  __schema_version: number;
  value: string;                            // build hash; rules check app_version >= this
  set_by: UserRef;
  set_at: Timestamp;
  reason: string;                           // why bumped (e.g., "schema v5 migration ships")
}
```

### `_migrations_backup/{batch_id}/{doc_path}/{timestamp}` (TTL'd)

Per [SCHEMA_MIGRATION.md](../architecture/SCHEMA_MIGRATION.md). Holds prior shape of normalized docs. 30-day TTL.

### `kpi_snapshots/{snapshot_id}` (steward KPI weekly card source)

```typescript
interface KPISnapshot {
  __schema_version: number;
  id: string;
  computed_at: Timestamp;
  window_start: Timestamp;
  window_end: Timestamp;
  metrics: {
    anomaly_inbox_aging_median_h: number;
    edit_with_reason_rate_per_1000: number;
    dispute_reopens_pct: number;
    anomaly_precision_pct: number;
  };
}
```

### `_rejected_writes/{rid}` (rotated-token + stale-build rejected writes)

Surfaces in steward inbox per [STEWARD_AFFORDANCES.md](../architecture/STEWARD_AFFORDANCES.md).

---

## Subcollections

### `jobs/{jid}/route_history/{rid}`

```typescript
interface RouteHistoryEvent {
  __schema_version: number;
  id: string;
  to_state: 'received' | 'pickling' | 'plating' | 'passivation' | 'fg-strip'
          | 'inspection' | 'ready' | 'dispatched' | 'rework';
  machine_id?: string;
  reason?: string;
  triggered_by: string;                     // worker_id
  client_created_at: Timestamp;
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
  idempotency_key: string;
}
```

### `jobs/{jid}/priority_bump_events/{eid}` (Phase 5 event-sourced)

```typescript
interface PriorityBumpEvent {
  __schema_version: number;
  id: string;
  delta: number;                            // +1, +2, etc.
  reason: string;
  triggered_by: string;
  client_created_at: Timestamp;
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
}
```

### `machines/{mid}/state_transitions/{tid}`

```typescript
interface StateTransition {
  __schema_version: number;
  id: string;
  from_state: 'running' | 'idle' | 'down' | 'maintenance' | 'inspecting';
  to_state: 'running' | 'idle' | 'down' | 'maintenance' | 'inspecting';
  reason?: string;
  expected_resolution_at?: Timestamp;
  linked_note_id?: string;
  triggered_by: string;
  client_created_at: Timestamp;
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
}
```

### `machines/{mid}/maintenance_log/{mid}`

```typescript
interface MaintenanceLog {
  __schema_version: number;
  id: string;
  performed_at: Timestamp;
  performed_by_user: string;
  next_due_at?: Timestamp;
  notes?: string;
  created_at: Timestamp;
  app_version: string;
}
```

### `workers/{wid}/shifts/{sid}`

```typescript
interface ShiftEvent {
  __schema_version: number;
  id: string;
  action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  location: 'home_room' | 'specific_room' | 'in_transit' | 'off_premises';
  linked_machine_id?: string;
  reason?: string;
  client_created_at: Timestamp;
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
}
```

### `stock_items/{sid}/receipts/{rid}`

```typescript
interface StockReceipt {
  __schema_version: number;
  id: string;
  qty_received: number;
  unit: 'kg' | 'L' | 'pcs' | 'units' | 'kWh';
  unit_cost: number;
  cost_unit: 'per_kg' | 'per_bag' | 'per_liter';
  supplier_id: string;                      // FK
  receipt_photo_url?: string;
  notes?: string;
  client_created_at: Timestamp;
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
}
```

### `stock_items/{sid}/depletions/{did}`

```typescript
interface StockDepletion {
  __schema_version: number;
  id: string;
  qty_depleted: number;
  reason: 'production_use' | 'waste' | 'spillage' | 'theft' | 'other';
  linked_machine_id?: string;
  notes?: string;
  client_created_at: Timestamp;
  created_at: Timestamp;
  app_version: string;
  author_user_id: string;
}
```

---

## Topic Digest Files

Generated hourly by CF cron from above source-of-truth Firestore data. See [`../architecture/TOPIC_DIGESTS.md`](../architecture/TOPIC_DIGESTS.md). Stored in repo at `docs/topics/{type}/{id}.md`. Markdown with YAML frontmatter; not in Firestore.

---

## Indexes (Firestore)

Composite indexes deployed via `firestore.indexes.json`:

- `production_entries: job_id ASC, created_at DESC`
- `production_entries: worker_id ASC, created_at DESC`
- `production_entries: machine_id ASC, created_at DESC`
- `dft_measurements: job_id ASC, measured_at DESC`
- `dispatch_events: customer_id ASC, dispatched_at DESC`
- `audit_events: entity_type ASC, entity_id ASC, recorded_at DESC`
- `audit_events: triggered_by_user ASC, recorded_at DESC`
- `notes: status ASC, priority DESC, created_at DESC`
- `notes: topic_refs ARRAY_CONTAINS, status ASC`

---

## Related

- [`../architecture/INDEX.md`](../architecture/INDEX.md) — architecture decision routing
- [`../architecture/DATA_HIERARCHY.md`](../architecture/DATA_HIERARCHY.md) — why this shape
- [`../architecture/SCHEMA_MIGRATION.md`](../architecture/SCHEMA_MIGRATION.md) — evolution discipline
- [`../architecture/SCHEMA_CHANGELOG.md`](../architecture/SCHEMA_CHANGELOG.md) — change log
- [`FIRESTORE_RULES.ref.txt`](FIRESTORE_RULES.ref.txt) — deployable rules file

---

*Authored 7 May 2026 by Aurelius. Live document — every schema change updates this file with a new `__schema_version` reference.*
