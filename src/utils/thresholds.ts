// Named threshold constants — import from here; never use magic numbers in components

// JVM heap (used % of max heap)
export const HEAP_WARN = 75
export const HEAP_CRIT = 85

// JVM heap vs total RAM
export const HEAP_RAM_WARN_PCT = 55            // heap max ≥ this % of RAM → over-allocated (warning)
export const HEAP_RAM_CRIT_PCT = HEAP_RAM_WARN_PCT + 1  // no graded crit band: any pct above warn reads as danger
export const HEAP_RAM_MAX_BYTES = 31 * 1024 ** 3  // heap max ≥ 31 GiB → compressed oops boundary (danger)

// Disk usage
export const DISK_HIGH = 70                    // low watermark — allocation throttled (warning)
export const DISK_ALLOC_BLOCKED = 85           // high watermark — shard allocation blocked (danger)
export const DISK_SHARD_MOVE = 90              // shards begin relocating off node
export const DISK_FLOOD = 95                   // flood-stage — all writes blocked

// CPU
export const CPU_WARN = 50
export const CPU_CRIT = 80

// Shards per node, as % of the cluster's per-node shard maximum
export const SHARD_COUNT_WARN_PCT = 86
export const SHARD_COUNT_CRIT_PCT = 96

// Circuit breakers (estimated / limit)
export const BREAKER_NOTABLE_RATIO = 0.6       // show a breaker once it is at least this full (or has tripped)
export const BREAKER_WARN_PCT = 70
export const BREAKER_CRIT_PCT = 90

// Kibana event loop delay (ms)
export const EVENT_LOOP_WARN_MS = 100
export const EVENT_LOOP_CRIT_MS = 500

// Pending cluster tasks: longest wait (ms)
export const PENDING_WAIT_WARN_MS = 30 * 1000
export const PENDING_WAIT_CRIT_MS = 5 * 60 * 1000

// ML node memory use (% of ML max)
export const ML_MEM_WARN_PCT = 75
export const ML_MEM_CRIT_PCT = 90

// Shard sizing
export const SHARD_OVERSIZED_GiB = 50          // primary shard ≥ this → oversized flag
export const SHARD_UNDERSIZED_GiB = 1          // primary shard < this (non-empty) → undersized flag

// Load percent (load_average.1m / allocatedProcessors * 100)
// Suppress load% display on nodes where RAM < 60 GB — host-level metric is unreliable on small Cloud VMs
export const LOAD_PERCENT_MIN_RAM_BYTES = 60 * 1024 ** 3  // 60 GiB
