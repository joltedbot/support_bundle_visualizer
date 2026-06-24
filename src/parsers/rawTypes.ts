/**
 * Raw ES API response interfaces shared across parsers.
 * Internal to the parsers package — not exported from index.ts.
 */

// ── ILM types ─────────────────────────────────────────────────────────────────

export interface ILMPhaseActions {
  rollover?: { max_age?: string; max_primary_shard_size?: string; max_size?: string; max_docs?: number }
  forcemerge?: { max_num_segments?: number }
  shrink?: { number_of_shards?: number }
  delete?: unknown
}

export interface ILMPhase {
  min_age?: string
  actions?: ILMPhaseActions
}

export interface ILMPolicyEntry {
  policy?: {
    phases?: {
      hot?: ILMPhase
      warm?: ILMPhase
      cold?: ILMPhase
      frozen?: ILMPhase
      delete?: ILMPhase
    }
  }
}

// ── Nodes stats types ─────────────────────────────────────────────────────────

export interface NodesStatsNodeEntry {
  name?: string
  jvm?: {
    mem?: { heap_used_percent?: number; heap_max_in_bytes?: number }
    uptime_in_millis?: number
  }
  process?: { cpu?: { percent?: number } }
  fs?: { total?: { total_in_bytes?: number; free_in_bytes?: number; available_in_bytes?: number } }
  os?: { cpu?: { percent?: number }; mem?: { total_in_bytes?: number } }
  indices?: { search?: { query_total?: number } }
}

export interface NodesStatsJson {
  nodes?: Record<string, NodesStatsNodeEntry>
}
