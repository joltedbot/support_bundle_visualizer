# Diagnostic Bundle Data Index

Complete inventory of all data available in Elasticsearch and Kibana diagnostic bundles.
Generated from representative bundles: Hinge (cloud/ESS), Presidents Choice Financial (self-hosted/cli), CPKC (self-hosted/cli).

**Bundle types**: Cloud (`api-diagnostics-*/`, runner `"ess"`) and Self-hosted (`local-diagnostics-*/`, runner `"cli"`) contain identical file sets. Self-hosted bundles additionally include `diagnostics.log`. Kibana bundles (`kibana-api-diagnostics-*/`) are separate and optional.

---

## Elasticsearch Bundle — Root-Level Files

### Cluster Identity & Metadata

| File | ES API | Description |
|------|--------|-------------|
| `manifest.json` | N/A (diagnostic tool) | Diagnostic collection metadata: tool version, collection timestamp, ES host URL. Used to extract cluster name and region for cloud deployments. |
| `diagnostic_manifest.json` | N/A (diagnostic tool) | Run metadata: `mode`, `product`, `runner` (ess/cli), `version`, `timestamp`, connection `flags`. Key differentiator between cloud and self-hosted. |
| `version.json` | `GET /` | ES version, build flavor/type/hash/date, Lucene version, wire/index compatibility versions, cluster name/UUID. |
| `diagnostics.log` | N/A (diagnostic tool) | **Self-hosted only.** Diagnostic tool execution log — every API call attempted, errors, internal hostnames/IPs of all nodes. Reveals network topology. |

### Cluster Health & State

| File | ES API | Description |
|------|--------|-------------|
| `cluster_health.json` | `_cluster/health` | Cluster status (green/yellow/red), node count, shard counts (active/relocating/initializing/unassigned), pending tasks, active shards percentage. |
| `cluster_state.json` | `_cluster/state` | Full cluster state: node list with attributes (AZ, region, instance_configuration), roles, routing tables, metadata, blocks. Very large file. |
| `cluster_stats.json` | `_cluster/stats` | Aggregate cluster statistics: node counts by role, index/shard/doc counts, store sizes, field type counts, segment stats, JVM/OS/process summaries across all nodes. |
| `cluster_pending_tasks.json` | `_cluster/pending_tasks` | Pending cluster-level tasks. Empty array when healthy. |
| `internal_health.json` | `_health_report` | Health report with per-indicator status: `master_is_stable`, `repository_integrity`, `disk`, `shards_capacity`, `file_settings`, `shards_availability`, `data_stream_lifecycle`, `slm`, `ilm`. |
| `internal_desired_balance.json` | `_internal/desired_balance` | Shard allocator's desired balance: per-tier distribution, per-node allocation targets with forecast write load and disk usage. |

### Cluster Settings

| File | ES API | Description |
|------|--------|-------------|
| `cluster_settings.json` | `_cluster/settings` | Explicitly configured settings only (persistent + transient). Contains allocation rules, ML config, SLM schedules, max_shards_per_node, etc. |
| `cluster_settings_defaults.json` | `_cluster/settings?include_defaults=true` | All settings including defaults. Massive file with every configurable setting and its default value. |

### Nodes

| File | ES API | Description |
|------|--------|-------------|
| `nodes.json` | `_nodes` | Full node configuration: name, roles, attributes (AZ, region, rack), transport/HTTP addresses, build info, settings (paths, security realms, discovery, SMTP), JVM args, OS info, installed plugins. **Self-hosted has dramatically richer settings** (auth realms, path config, discovery seeds, SMTP, audit config). |
| `nodes_stats.json` | `_nodes/stats` | Per-node runtime statistics: indices (docs, store, indexing, search, merges, refresh, flush, query cache, fielddata, segments, translog), OS (cpu, mem, swap), process, JVM (heap, GC, buffer pools), thread pools, filesystem, transport, HTTP. |
| `nodes_short.json` | `_cat/nodes?format=json` | Compact node list: name, ID, master flag, IP, role codes. |
| `nodes_usage.json` | `_nodes/usage` | Per-node REST API usage counters since restart: how many times each action (bulk, search, index, etc.) was called. |
| `nodes_hot_threads.txt` | `_nodes/hot_threads` | Java thread dump per node showing busiest threads by CPU. Full stack traces. Very large file (60K+ lines). |
| `master.json` | `_cat/master?format=json` | Current elected master node identity (ID, host, IP, name). |

### Indices & Mappings

| File | ES API | Description |
|------|--------|-------------|
| `indices.json` | `_cat/indices?format=json` | Per-shard index listing: index name, shard number, primary/replica, state, doc count, store size, node, merge/flush/indexing metrics. |
| `indices_stats.json` | `_stats` | Comprehensive per-index statistics: docs, store, indexing rate, search rate, merges, refresh, flush, segments, translog, query cache, fielddata, completion. Has both `_all` aggregate and per-index breakdowns. |
| `mapping.json` | `_mapping` | All index mappings: field names, types, analyzers, dense_vector dims, inference_id, semantic_text config. The source for field-type analysis and AI/ML feature detection. |
| `settings.json` | `_settings` | Per-index settings: creation date, shard/replica counts, routing tier preferences, sort config, ILM policy, refresh interval, codec, UUID. |
| `count.json` | `_count` | Total document count across all user indices. |

### Shards & Allocation

| File | ES API | Description |
|------|--------|-------------|
| `shards.json` | `_cat/shards?format=json` | Per-shard placement: index, shard number, primary/replica, state, doc count, store size, node assignment. |
| `allocation.json` | `_cat/allocation?format=json` | Per-node disk allocation: shard count, disk used/available/total, disk percent, host, IP, node, roles. |
| `allocation_explain.json` | `_cluster/allocation/explain` | Shard allocation decision explanation. Returns error when no unassigned shards (healthy). |
| `allocation_explain_disk.json` | `_cluster/allocation/explain` (disk filter) | Disk-focused allocation explanation. Same as above — error when healthy. |
| `shard_stores.json` | `_shard_stores` | Shard store copies across nodes. Only populated for problematic/unassigned shards. Empty when healthy. |
| `recovery.json` | `_recovery` | Per-index shard recovery details: type (PEER/SNAPSHOT), stage, source/target nodes, bytes/files recovered, translog progress, timing. |
| `segments.json` | `_segments` | Per-index, per-shard Lucene segment details: segment name, generation, doc count, deleted docs, size, Lucene version, compound flag, sort fields. |
| `dangling_indices.json` | `_dangling` | Indices on disk not in cluster state. Empty when healthy. |

### Templates

| File | ES API | Description |
|------|--------|-------------|
| `templates.json` | `_template` | Legacy (v1) index templates: index patterns, order, settings, mappings, aliases. Primarily monitoring templates. |
| `index_templates.json` | `_index_template` | Composable (v2) index templates: index patterns, composed_of references, priority, settings, mappings, data stream config. |
| `component_templates.json` | `_component_template` | Reusable component templates (building blocks for index templates): template settings, mappings, metadata. |

### Aliases

| File | ES API | Description |
|------|--------|-------------|
| `alias.json` | `_alias` | All index aliases: maps index names to aliases with `is_write_index`, `is_hidden` flags. |

### Ingest Pipelines

| File | ES API | Description |
|------|--------|-------------|
| `pipelines.json` | `_ingest/pipeline` | All ingest pipelines: description, processor chain, version, metadata. Includes both built-in (APM, Fleet, Elastic Agent) and custom pipelines. |

### Fielddata

| File | ES API | Description |
|------|--------|-------------|
| `fielddata.json` | `_cat/fielddata?format=json` | Per-node, per-field fielddata cache sizes. |
| `fielddata_stats.json` | `_nodes/stats/indices/fielddata?fields=*` | Per-node fielddata memory usage and eviction statistics by field. Includes global_ordinals build time. |

### GeoIP

| File | ES API | Description |
|------|--------|-------------|
| `geoip_stats.json` | `_ingest/geoip/stats` | GeoIP database download stats and per-node database inventory (GeoLite2 ASN/Country/City). Cache hit/miss stats. |

### Security

| File | ES API | Description |
|------|--------|-------------|
| `ssl_certs.json` | `_ssl/certificates` | Loaded TLS/SSL certificates: path, format, subject DN, serial, expiry, issuer, private key flag. **Self-hosted has real PKI chains; cloud is empty/minimal.** |
| `licenses.json` | `_license` | License details: UID, type (platinum/enterprise/basic), status, issue/expiry dates, max nodes, issuer, issued-to organization. |
| `plugins.json` | `_cat/plugins?format=json` | Per-node installed plugins with component name and version. |

### Tasks

| File | ES API | Description |
|------|--------|-------------|
| `tasks.json` | `_tasks` | Currently executing tasks: action type, description, start time, running time, cancellability, parent task relationships. Per-node breakdown. |

### Remote Clusters

| File | ES API | Description |
|------|--------|-------------|
| `remote_cluster_info.json` | `_remote/info` | Remote cluster (CCS/CCR) connection config. Empty when no remote clusters configured. |

### Snapshots

| File | ES API | Description |
|------|--------|-------------|
| `repositories.json` | `_snapshot` | Registered snapshot repositories: type (s3/fs/azure/gcs), settings (bucket, base_path, compression). **Cloud uses cloud storage; self-hosted uses filesystem mounts.** |
| `snapshot.json` | `_snapshot/_all` | All snapshots across all repositories: name, state (SUCCESS/FAILED), indices, start/end time, shard counts. |

---

## Elasticsearch Bundle — `commercial/` Subdirectory

### ILM (Index Lifecycle Management)

| File | ES API | Description |
|------|--------|-------------|
| `ilm_policies.json` | `_ilm/policy` | All ILM policy definitions: phases (hot/warm/cold/frozen/delete), actions per phase, version, metadata. |
| `ilm_explain.json` | `_all/_ilm/explain` | Per-index ILM status: current phase/action/step, policy name, age, managed flag. Large file for clusters with many indices. |
| `ilm_explain_only_errors.json` | `*/_ilm/explain?only_errors=true` | ILM explain filtered to error states only. Empty when no ILM errors. |
| `ilm_status.json` | `_ilm/status` | ILM operating mode: RUNNING, STOPPING, or STOPPED. |

### Data Streams

| File | ES API | Description |
|------|--------|-------------|
| `data_stream.json` | `_data_stream` | All data streams: name, backing indices, timestamp field, generation, status, ILM policy, system flag, hidden flag, `managed_by` (e.g., "Index Lifecycle Management", "Data stream lifecycle"). |

### ML (Machine Learning)

| File | ES API | Description |
|------|--------|-------------|
| `ml_anomaly_detectors.json` | `_ml/anomaly_detectors` | Anomaly detection job definitions: analysis config (detectors, influencers, bucket span), data description, model config, groups. |
| `ml_stats.json` | `_ml/anomaly_detectors/_stats` | Anomaly detection job statistics: state, data counts, model size, timing. |
| `ml_datafeeds.json` | `_ml/datafeeds` | Datafeed definitions: job_id, indices, query, frequency, scroll_size, chunking config. |
| `ml_datafeeds_stats.json` | `_ml/datafeeds/_stats` | Datafeed statistics: state, assignment, timing, running_state, node. |
| `ml_dataframe.json` | `_ml/data_frame/analytics` | Data frame analytics (DFA) job definitions: source/dest indices, analysis type (outlier_detection, regression, classification). |
| `ml_dataframe_stats.json` | `_ml/data_frame/analytics/_stats` | DFA job statistics: state, progress, assignment, data/memory counts. |
| `ml_trained_models.json` | `_ml/trained_models` | Trained model definitions: model_id, model_type (pytorch, tree_ensemble, lang_ident), inference config, tags, create_time. |
| `ml_trained_models_stats.json` | `_ml/trained_models/_stats` | Trained model statistics: pipeline count, deployment stats (allocation status, threads, queue, inference count, cache). |
| `ml_info.json` | `_ml/info` | ML subsystem defaults/limits: model memory limit, categorization analyzer, native code version, effective max model memory. |
| `ml_memory_stats.json` | `_ml/memory/_stats` | Per-node ML memory breakdown: total RAM, JVM heap max, ML-specific memory (anomaly detectors, DFA, native inference, Java inference). |

### Transforms

| File | ES API | Description |
|------|--------|-------------|
| `transform.json` | `_transform` | Transform definitions: source indices, destination index, query, frequency, sync config, pivot/latest config, authorization, settings. |
| `transform_stats.json` | `_transform/_stats` | Transform statistics: state, processing stats (docs indexed/processed, trigger count, search/index time), checkpointing, health. |
| `transform_basic_stats.json` | `_transform/_stats?_basic` | Same as transform_stats but with basic info only (slightly less detail in checkpointing). |
| `transform_node_stats.json` | `_transform/_node_stats` | Per-node transform scheduler: registered transform count, peek transform. |

### CCR (Cross-Cluster Replication)

| File | ES API | Description |
|------|--------|-------------|
| `ccr_stats.json` | `_ccr/stats` | CCR statistics: auto-follow success/failure counts, per-index follower stats. |
| `ccr_autofollow_patterns.json` | `_ccr/auto_follow` | Auto-follow pattern definitions for automatic CCR replication. |
| `ccr_follower_info.json` | `_ccr/follow_info` | CCR follower index details: leader index, remote cluster, follow parameters. |

### SLM (Snapshot Lifecycle Management)

| File | ES API | Description |
|------|--------|-------------|
| `slm_policies.json` | `_slm/policy` | SLM policy definitions: schedule, repository, retention rules, execution stats (last success/failure, snapshots taken/failed/deleted). |
| `slm_stats.json` | `_slm/stats` | Aggregate SLM statistics: retention runs, total snapshots taken/failed/deleted, per-policy breakdowns. |
| `slm_status.json` | `_slm/status` | SLM operating mode: RUNNING, STOPPING, or STOPPED. |

### Watcher

| File | ES API | Description |
|------|--------|-------------|
| `watcher_stats.json` | `_watcher/stats/_all` | Per-node watcher stats: watcher_state, watch_count, execution thread pool, plus `current_watches` and `queued_watches` arrays. |
| `watcher_stack.json` | `_watcher/stats` | Same as watcher_stats but without current/queued watches detail. |

### Security

| File | ES API | Description |
|------|--------|-------------|
| `security_users.json` | `_security/user` | Native realm user accounts: username, roles, full_name, email, enabled, metadata. No passwords. **Self-hosted has custom service accounts; cloud typically only reserved users.** |
| `security_roles.json` | `_security/role` | All security roles: cluster privileges, index privileges, application privileges, run_as, reserved flag. **Self-hosted has many custom domain-specific roles.** |
| `security_role_mappings.json` | `_security/role_mapping` | External identity → role mappings (SAML/LDAP/AD/OIDC). Mapping rules, enabled state, target roles. **Self-hosted has AD group mappings; cloud is typically empty.** |
| `security_priv.json` | `_security/privilege` | Application privileges (primarily Kibana feature privileges). Keyed by application, then privilege name. |

### Enrich

| File | ES API | Description |
|------|--------|-------------|
| `enrich_policies.json` | `_enrich/policy` | Enrich policy definitions for enriching documents during ingest. |
| `enrich_stats.json` | `_enrich/_stats` | Enrich execution stats: coordinator queue/remote requests, cache hits/misses/evictions per node. |

### Rollup

| File | ES API | Description |
|------|--------|-------------|
| `rollup_jobs.json` | `_rollup/job` | Rollup job definitions for aggregating historical data. |
| `rollup_caps.json` | `_rollup/data` | Rollup capabilities: which indices have rollup data. |
| `rollup_index_caps.json` | `<index>/_rollup/data` | Per-index rollup capabilities. |

### Searchable Snapshots

| File | ES API | Description |
|------|--------|-------------|
| `searchable_snapshots_stats.json` | `_searchable_snapshots/stats` | Per-index searchable snapshot statistics. 404 when no searchable snapshot indices exist. |
| `searchable_snapshots_cache_stats.json` | `_searchable_snapshots/cache/stats` | Per-node shared cache stats: reads, writes, bytes transferred, evictions, region count, cache size. |

### Logstash (Centrally Managed)

| File | ES API | Description |
|------|--------|-------------|
| `logstash_pipeline.json` | `_logstash/pipeline` | Centrally-managed Logstash pipeline configurations stored in ES. **Self-hosted can have many (e.g., CPKC has 64); cloud is typically empty.** |

### Other Commercial Features

| File | ES API | Description |
|------|--------|-------------|
| `xpack.json` | `_xpack/usage` | X-Pack feature usage statistics: comprehensive overview of which features are available/enabled and their usage metrics (CCR, data tiers, data streams, analytics, ML, security, watcher, monitoring, etc.). |
| `autoscaling_capacity.json` | `_autoscaling/capacity` | Autoscaling capacity decisions per policy. **Cloud has policies; self-hosted is empty.** |
| `nodes_shutdown_status.json` | `_nodes/shutdown` | Node shutdown requests for planned maintenance/decommission. |
| `profiling_status.json` | `_profiling/status` | Universal Profiling status: enabled flag, resource management state, data existence. |

---

## Elasticsearch Bundle — `cat/` Subdirectory

Human-readable text files from the `_cat` APIs with column headers.

| File | ES API | Description |
|------|--------|-------------|
| `cat_aliases.txt` | `_cat/aliases` | All aliases → index mappings. Columns: `alias`, `index`, `filter`, `routing.index`, `routing.search`, `is_write_index`. |
| `cat_allocation.txt` | `_cat/allocation` | Per-node disk allocation. Columns: `shards`, `shards.undesired`, `write_load.forecast`, `disk.indices.forecast`, `disk.indices`, `disk.used`, `disk.avail`, `disk.total`, `disk.percent`, `host`, `ip`, `node`, `node.role`. |
| `cat_count.txt` | `_cat/count` | Cluster-wide document count. Columns: `epoch`, `timestamp`, `count`. |
| `cat_fielddata.txt` | `_cat/fielddata` | Per-node, per-field fielddata memory. Columns: `id`, `host`, `ip`, `node`, `field`, `size`. |
| `cat_health.txt` | `_cat/health` | Cluster health snapshot. Columns: `epoch`, `timestamp`, `cluster`, `status`, `node.total`, `node.data`, `shards`, `pri`, `relo`, `init`, `unassign`, `pending_tasks`, `max_task_wait_time`, `active_shards_percent`. |
| `cat_indices.txt` | `_cat/indices` | Per-index summary. Columns: `health`, `status`, `index`, `uuid`, `pri`, `rep`, `docs.count`, `docs.deleted`, `store.size`, `pri.store.size`. |
| `cat_master.txt` | `_cat/master` | Current master node. Columns: `id`, `ip`, `host`, `node`. |
| `cat_nodeattrs.txt` | `_cat/nodeattrs` | Per-node custom attributes (one row per attribute). Columns: `node`, `id`, `pid`, `host`, `ip`, `port`, `attr`, `value`. Contains AZ, region, instance_configuration, rack, etc. |
| `cat_nodes.txt` | `_cat/nodes` | Per-node resource summary. Columns: `name`, `nodeId`, `ip`, `version`, `role`, `master`, `disk.total`, `disk.used_percent`, `heap.percent`, `cpu`, `load_1m/5m/15m`, indexing/search/query counts. |
| `cat_pending_tasks.txt` | `_cat/pending_tasks` | Pending cluster tasks. Columns: `insertOrder`, `timeInQueue`, `priority`, `source`. |
| `cat_recovery.txt` | `_cat/recovery` | Shard recovery events. Columns: `index`, `shard`, `time`, `type`, `stage`, `source_host/node`, `target_host/node`, `repository`, `snapshot`, `files`, `bytes`, `translog_ops` (with progress percentages). |
| `cat_repositories.txt` | `_cat/repositories` | Snapshot repositories. Columns: `id`, `type`. |
| `cat_segments.txt` | `_cat/segments` | Per-shard Lucene segments. Columns: `index`, `shard`, `prirep`, `ip`, `segment`, `generation`, `docs.count`, `docs.deleted`, `size`, `size.memory`, `committed`, `searchable`, `version`, `compound`. Very large file. |
| `cat_shards.txt` | `_cat/shards` | Per-shard placement. Columns: `index`, `shard`, `prirep`, `state`, `docs`, `store`, `dataset`, `ip`, `node`. |
| `cat_templates.txt` | `_cat/templates` | All index templates. Columns: `name`, `index_patterns`, `order`, `version`, `composed_of`. |
| `cat_thread_pool.txt` | `_cat/thread_pool` | Per-node thread pool stats. Columns: `node_name`, `name`, `active`, `queue`, `rejected`. One row per (node, pool). Key for detecting thread pool pressure. |

---

## Kibana Bundle Files

Kibana bundles are in `kibana-api-diagnostics-*/` directories alongside the ES bundle. All files are JSON.

### Instance Health & Status

| File | Kibana API | Description |
|------|------------|-------------|
| `kibana_status.json` | `GET /api/status` | Overall Kibana status: version info, overall/core/plugin health levels. Core services: `elasticsearch`, `savedObjects`. Per-plugin status: `alerting`, `taskManager`, `transform`, etc. **Primary source for Kibana version and heap `size_limit`.** |
| `kibana_stats.json` | `GET /api/stats?extended=true` | Instance statistics: process memory (heap, RSS), event loop delay, OS info (platform, load, memory), request counts/status codes, response times, concurrent connections, Kibana uuid/version. |
| `kibana_task_manager_health.json` | `GET /api/task_manager/_health` | Task Manager health: configuration (capacity, poll_interval, claim_strategy), runtime polling stats with drift percentiles, per-task-type workload breakdown (scheduled/running/idle counts). |
| `kibana_alerts_health.json` | `GET /api/alerting/_health` | Alerting framework health: encryption key presence, decryption/execution/read health with status and timestamps. |
| `kibana_stack_monitoring_health.json` | `GET /api/monitoring/v1/_health` | Stack Monitoring health. Often 400 when not configured. |

### Alerting & Connectors

| File | Kibana API | Description |
|------|------------|-------------|
| `kibana_alerts_1.json` | `GET /api/alerting/rules/_find` (page 1) | Paginated alerting rules: threshold alerts, SIEM rules, APM rules, etc. Shows rule type, schedule, actions, enabled state. Paginated — `_1` suffix means page 1. |
| `kibana_actions.json` | `GET /api/actions` | All connectors (Slack, email, webhook, PagerDuty, Jira, etc.): id, name, actionTypeId, config. |

### Security — Detection Engine

| File | Kibana API | Description |
|------|------------|-------------|
| `kibana_detection_engine_rules_installed_1.json` | `GET /api/detection_engine/rules/_find` (page 1) | Installed SIEM detection rules (custom + prebuilt): rule type, severity, query, enabled state. `total` field shows total count. |
| `kibana_detection_engine_rules_prebuilt_status.json` | `GET /internal/detection_engine/prebuilt_rules/status` | Prebuilt rules status: installed vs available count, update availability. Often 400 on older/unconfigured deployments. |
| `kibana_detection_engine_health_cluster.json` | `GET /internal/detection_engine/health/_cluster` | Cluster-level detection engine health. Often 400 when Security solution not fully enabled. |
| `kibana_detection_engine_health_space.json` | `GET /internal/detection_engine/health/_space` | Space-level detection engine health. Often 400 when not configured. |
| `kibana_detection_engine_privileges.json` | `GET /api/detection_engine/privileges` | User privileges check for detection engine: cluster privs (manage_ml, monitor), index privs on `.alerts-security.alerts-default`, encryption key status. |

### Security — Endpoint

| File | Kibana API | Description |
|------|------------|-------------|
| `kibana_security_endpoint_metadata_1.json` | `GET /api/endpoint/metadata` (page 1) | Enrolled Elastic Defend endpoints: agent version, OS, policy, isolation status, last check-in. Empty when Endpoint not deployed. |
| `kibana_security_endpoint_trusted_apps_1.json` | `GET /api/exception_lists/items/_find?list_id=endpoint_trusted_apps` | Endpoint trusted applications (executables excluded from malware scanning). |
| `kibana_security_endpoint_event_filters_1.json` | `GET /api/exception_lists/items/_find?list_id=endpoint_event_filters` | Endpoint event filters (rules suppressing specific endpoint events). 404 when list doesn't exist. |
| `kibana_security_endpoint_exception_items_1.json` | `GET /api/exception_lists/items/_find?list_id=endpoint_list` | Endpoint exceptions (exclusions for malware/ransomware/behavior protection). |
| `kibana_security_endpoint_host_isolation_1.json` | `GET /api/exception_lists/items/_find?list_id=endpoint_host_isolation_exceptions` | Host isolation exceptions (IPs/CIDRs excluded from network isolation). 404 when list doesn't exist. |

### Security — Exception Lists & Roles

| File | Kibana API | Description |
|------|------------|-------------|
| `kibana_security_exception_list_1.json` | `GET /api/exception_lists/_find` (page 1) | Exception list containers (not items): list_id, type (endpoint/detection/rule_default), name, immutable, namespace_type. |
| `kibana_lists_privileges.json` | `GET /api/lists/privileges` | User privileges on exception list indices (`.items-default`, `.lists-default`). |
| `kibana_roles.json` | `GET /api/security/role` | All security roles (built-in + custom): ES cluster/index privileges, Kibana feature/space privileges, reserved flag. |
| `kibana_security_packages.json` | `GET /api/fleet/epm/packages?category=security` | Security-category Fleet packages (Elastic Defend, Prebuilt Rules). Often 400 on query parameter issues. |

### Fleet & Agents

| File | Kibana API | Description |
|------|------------|-------------|
| `kibana_fleet_agents_1.json` | `GET /api/fleet/agents` (page 1) | Enrolled Fleet agents: status, version, policy assignment, host details. Empty when Fleet not in use. |
| `kibana_fleet_agent_status.json` | `GET /api/fleet/agent_status` | Aggregate agent counts by status: online, error, inactive, offline, updating, unenrolled, orphaned, all. |
| `kibana_fleet_agent_policies_1.json` | `GET /api/fleet/agent_policies` (page 1) | Agent policies: which integrations/inputs each policy defines. |
| `kibana_fleet_packages.json` | `GET /api/fleet/epm/packages` | Installed integration packages (system, endpoint, nginx, custom, etc.). Often 400 on parameter issues. |
| `kibana_fleet_settings.json` | `GET /api/fleet/settings` | Fleet global settings: ILM migration status, prerelease integrations toggle, knowledge base flag. |
| `kibana_fleet_agents_current_upgrades.json` | `GET /api/fleet/agents/current_upgrades` | Agents currently being upgraded. 404 when no active upgrades. |

### Spaces & Data Views

| File | Kibana API | Description |
|------|------------|-------------|
| `kibana_spaces.json` | `GET /api/spaces/space` | All Kibana spaces: id, name, color, description, disabledFeatures, reserved flag. |
| `kibana_data_views.json` | `GET /api/data_views` | All data views (index patterns): id, title, name, timeFieldName, managed flag, namespaces. |

### Synthetics & Uptime

| File | Kibana API | Description |
|------|------------|-------------|
| `kibana_synthetics_monitor_filters.json` | `GET /internal/synthetics/monitor/filters` | Synthetics monitor facets (locations, tags, types, projects). Often 400 when not configured. |
| `kibana_synthetics_private_locations.json` | `GET /api/synthetics/private_locations` | Private testing locations for synthetic monitoring. Empty array when not configured. |
| `kibana_uptime_locations.json` | `GET /internal/uptime/service/locations` | Uptime monitoring locations. Often 400 when not configured. |
| `kibana_uptime_settings.json` | `GET /api/uptime/settings` | Uptime app config: heartbeat index pattern, certificate expiration/age thresholds, default connectors and email recipients. |

### Reporting & User

| File | Kibana API | Description |
|------|------------|-------------|
| `kibana_reporting_diagnose_browser.json` | `GET /internal/reporting/diagnose/browser` | Chromium browser diagnostics for Reporting (PDF/PNG). Often 400 when not configured. |
| `kibana_user.json` | `GET /internal/security/me` | Authenticated user that ran the diagnostic: username, roles, auth realm. Often 400. |

### Manifests

| File | Kibana API | Description |
|------|------------|-------------|
| `manifest.json` | N/A (diagnostic tool) | Kibana diagnostic collection metadata. |
| `diagnostic_manifest.json` | N/A (diagnostic tool) | Run metadata for the Kibana diagnostic. |

### Per-Space Files

Kibana bundles may include `space_<space-id>/` subdirectories with space-scoped copies of certain files (e.g., `kibana_alerts_1.json`). Present when multiple Kibana spaces exist.

---

## Cloud vs Self-Hosted Data Differences

The file set is identical between cloud and self-hosted bundles. The meaningful differences are in data richness:

| Data Area | Cloud (ESS) | Self-Hosted |
|-----------|-------------|-------------|
| **SSL Certs** (`ssl_certs.json`) | Minimal (ESS-managed) | Full PKI chain — corporate CA, node certs, expiry dates |
| **Native Users** (`security_users.json`) | Reserved users only | Custom service accounts (Logstash, NiFi, app-specific) |
| **Custom Roles** (`security_roles.json`) | Few or none | Domain-specific roles (e.g., 25 custom roles in CPKC) |
| **Role Mappings** (`security_role_mappings.json`) | Empty (cloud SSO managed externally) | AD/LDAP/SAML group → role mappings (e.g., 22 in CPKC) |
| **Node Settings** (`nodes.json` → `settings`) | Sparse (cloud-managed) | Rich: path config, auth realm config, discovery seeds, SMTP, audit settings |
| **Logstash Pipelines** (`logstash_pipeline.json`) | Empty | Can be extensive (e.g., 64 centrally-managed pipelines in CPKC) |
| **SLM Policies** (`slm_policies.json`) | Cloud-managed (`cloud-snapshot-policy`) | Customer-configured backup strategies |
| **Snapshot Repos** (`repositories.json`) | Cloud storage (S3/GCS/Azure) | Filesystem mounts (NFS/SAN) |
| **Autoscaling** (`autoscaling_capacity.json`) | Active policies | Empty (bare metal) |
| **Build Type** (`version.json`) | `docker` | `rpm`, `deb`, `tar` |
| **Runner** (`diagnostic_manifest.json`) | `ess` | `cli` |
| **diagnostics.log** | Not present | Present — contains internal hostnames, IPs, network topology |

---

## App Usage Status

The visualizer currently reads **42 of 97 ES bundle files** and **5 of 37 Kibana bundle files**. This section catalogs what is and isn't used.

### Currently Used (42 ES + 5 Kibana)

**ES Root (15):** `diagnostic_manifest.json`, `manifest.json`, `version.json`, `cluster_health.json`, `cluster_stats.json`, `cluster_settings.json`, `nodes.json`, `nodes_stats.json`, `mapping.json`, `settings.json`, `pipelines.json`, `repositories.json`, `remote_cluster_info.json`, `plugins.json`, `licenses.json`

**ES commercial/ (18):** `ilm_explain.json`, `ilm_policies.json`, `ml_info.json`, `ml_trained_models.json`, `ml_trained_models_stats.json`, `ml_memory_stats.json`, `ml_anomaly_detectors.json`, `ml_stats.json`, `ml_datafeeds.json`, `ml_datafeeds_stats.json`, `ml_dataframe.json`, `ml_dataframe_stats.json`, `watcher_stats.json`, `transform.json`, `enrich_policies.json`, `ccr_stats.json`, `slm_policies.json`, `data_stream.json`

**ES cat/ (4):** `cat_indices.txt`, `cat_shards.txt`, `cat_nodeattrs.txt`, `cat_nodes.txt`

**Kibana (5):** `kibana_status.json`, `kibana_alerts_health.json`, `kibana_task_manager_health.json`, `kibana_fleet_agent_status.json`, `kibana_data_views.json`

---

### Unused Data — Grouped by Information Category

Below is every unused file, grouped by the type of information it represents. Each group is a potential feature area you could decide to surface (or not). Items marked **(self-hosted rich)** have significantly more data in self-hosted bundles.

#### 1. Thread Pool Pressure & Rejections
| File | What it provides |
|------|-----------------|
| `cat/cat_thread_pool.txt` | Per-node, per-pool active/queued/rejected counts. Key for spotting write, search, and bulk rejections. |

**SA value**: Thread pool rejections are one of the first things to check during performance issues. High rejection counts in `write`, `search`, or `generic` pools indicate saturation.

#### 2. Cluster Health Report (Detailed Indicators)
| File | What it provides |
|------|-----------------|
| `internal_health.json` | 9 health indicators with status + diagnosis: master stability, repository integrity, disk, shards capacity, file settings, shard availability, data stream lifecycle, SLM, ILM. |

**SA value**: Goes beyond green/yellow/red — surfaces specific problems like "master is unstable", "SLM policy failing", "ILM stagnating on N indices". Actionable recommendations built in.

#### 3. Index-Level Performance Statistics
| File | What it provides |
|------|-----------------|
| `indices_stats.json` | Per-index indexing rate, search rate, merge time, refresh time, flush time, query cache hit/miss, segment count, translog size. Also `_all` aggregate. |

**SA value**: Identifies hot indices (high indexing/search rate), merge-heavy indices, and indices with poor query cache hit ratios. The `_all` summary gives cluster-wide I/O profile.

#### 4. Shard Allocation Problems
| File | What it provides |
|------|-----------------|
| `allocation_explain.json` | Why unassigned shards can't be allocated (node filters, disk watermark, allocation rules). |
| `allocation_explain_disk.json` | Disk-specific allocation decisions. |
| `shard_stores.json` | Shard store copies — which nodes hold copies of problematic shards. |
| `dangling_indices.json` | Indices on disk but not in cluster state (orphaned data). |

**SA value**: Critical for yellow/red clusters. Currently the app shows unassigned shard counts but not *why* they're unassigned.

#### 5. Shard Recovery Activity
| File | What it provides |
|------|-----------------|
| `recovery.json` | Per-shard recovery: type (peer/snapshot), stage, bytes/files transferred, translog replay progress, timing. |
| `cat/cat_recovery.txt` | Same in text format with progress percentages. |

**SA value**: Shows whether the cluster is actively recovering shards (after node restart, scaling event, or rebalancing) and how long recoveries are taking.

#### 6. Segment-Level Detail
| File | What it provides |
|------|-----------------|
| `segments.json` | Per-shard Lucene segments: count, sizes, deleted doc ratios, Lucene versions. |
| `cat/cat_segments.txt` | Same in text format. |

**SA value**: High segment counts or high deleted-doc ratios indicate forcemerge opportunities. Mixed Lucene versions suggest index compatibility concerns during upgrades.

#### 7. Index Templates & Component Templates
| File | What it provides |
|------|-----------------|
| `templates.json` | Legacy (v1) index templates. |
| `index_templates.json` | Composable (v2) index templates with composed_of references. |
| `component_templates.json` | Reusable component templates. |

**SA value**: Template misconfiguration is a common source of issues (wrong shard counts, missing ILM policy, incorrect mappings). Showing template counts and composition helps SAs audit template design.

#### 8. Aliases
| File | What it provides |
|------|-----------------|
| `alias.json` | All index aliases with write_index and hidden flags. |
| `cat/cat_aliases.txt` | Same in text format. |

**SA value**: Alias configuration reveals data routing patterns. Misconfigured write aliases cause ingestion failures.

#### 9. Security Configuration **(self-hosted rich)**
| File | What it provides |
|------|-----------------|
| `commercial/security_users.json` | Native user accounts, roles assigned, enabled status. |
| `commercial/security_roles.json` | All security roles: cluster/index/application privileges. |
| `commercial/security_role_mappings.json` | External identity (AD/LDAP/SAML/OIDC) → ES role mappings. |
| `commercial/security_priv.json` | Application privileges (Kibana feature access). |
| `ssl_certs.json` | TLS certificates: subject, issuer, expiry dates, PKI chain. |

**SA value**: For self-hosted: shows the full RBAC model, external auth integration (AD/LDAP/SAML), and certificate expiry. For cloud: minimal but shows custom roles if any. Certificate expiry is operationally critical.

#### 10. Snapshot Detail
| File | What it provides |
|------|-----------------|
| `snapshot.json` | All snapshots: name, state (SUCCESS/FAILED), indices, start/end time, shard counts, failure details. |

**SA value**: Currently the app shows repository count and SLM policy count, but not actual snapshot success/failure history. Failed snapshots indicate backup problems.

#### 11. SLM & Snapshot Statistics
| File | What it provides |
|------|-----------------|
| `commercial/slm_stats.json` | Aggregate SLM stats: retention runs, total snapshots taken/failed/deleted. |
| `commercial/slm_status.json` | SLM operating mode (RUNNING/STOPPED). |

**SA value**: SLM being STOPPED or high failure counts are red flags. Currently the app reads SLM policies but not the execution stats.

#### 12. ILM Errors & Status
| File | What it provides |
|------|-----------------|
| `commercial/ilm_explain_only_errors.json` | Indices stuck in ILM error state. |
| `commercial/ilm_status.json` | ILM operating mode (RUNNING/STOPPED). |

**SA value**: ILM errors cause indices to stop progressing through lifecycle phases, leading to disk bloat. Currently the app shows ILM policies and managed indices but not error states.

#### 13. Searchable Snapshots
| File | What it provides |
|------|-----------------|
| `commercial/searchable_snapshots_stats.json` | Per-index searchable snapshot statistics. |
| `commercial/searchable_snapshots_cache_stats.json` | Per-node shared cache: reads, writes, evictions, size, region count. |

**SA value**: For clusters using frozen tier / searchable snapshots, cache performance is critical. High eviction rates indicate undersized cache.

#### 14. Node API Usage Patterns
| File | What it provides |
|------|-----------------|
| `nodes_usage.json` | Per-node REST API call counters (bulk, search, index, scroll, etc.) since restart. |

**SA value**: Shows workload profile — is this cluster search-heavy or ingest-heavy? High scroll counts suggest legacy pagination. High bulk counts show write-intensive workloads.

#### 15. Pending & Running Tasks
| File | What it provides |
|------|-----------------|
| `tasks.json` | Currently executing tasks: action type, running time, cancellability. |
| `cluster_pending_tasks.json` | Pending cluster-level tasks waiting for master. |
| `cat/cat_pending_tasks.txt` | Same in text format. |

**SA value**: Long-running tasks or large pending task queues indicate master node pressure or resource contention.

#### 16. Hot Threads
| File | What it provides |
|------|-----------------|
| `nodes_hot_threads.txt` | Per-node Java thread dump with CPU usage percentages and full stack traces. Very large (60K+ lines). |

**SA value**: Definitive source for diagnosing what threads are consuming CPU. Not practical to render in full, but could surface top-N hot threads per node.

#### 17. Fielddata Analysis
| File | What it provides |
|------|-----------------|
| `fielddata.json` | Per-node, per-field fielddata cache sizes. |
| `fielddata_stats.json` | Per-node fielddata eviction counts, memory usage by field, global ordinals build time. |

**SA value**: High fielddata usage is a common cause of OOM circuit breaker trips. Currently the app shows aggregate fielddata from cluster_stats but not the per-field breakdown.

#### 18. GeoIP Stats
| File | What it provides |
|------|-----------------|
| `geoip_stats.json` | GeoIP database inventory per node, download stats, cache hit/miss. |

**SA value**: Niche — only relevant when GeoIP ingest is used. Shows whether databases are current.

#### 19. Watcher Detail
| File | What it provides |
|------|-----------------|
| `commercial/watcher_stack.json` | Per-node watcher state and watch count (subset of watcher_stats). |

**SA value**: The app already reads `watcher_stats.json`. This file is redundant (less detail than watcher_stats).

#### 20. Transform Statistics
| File | What it provides |
|------|-----------------|
| `commercial/transform_stats.json` | Per-transform processing stats: docs indexed/processed, trigger count, search/index time, health. |
| `commercial/transform_basic_stats.json` | Same with slightly less detail. |
| `commercial/transform_node_stats.json` | Per-node transform scheduler registered count. |

**SA value**: The app currently reads `transform.json` (definitions) for count. The stats files show whether transforms are healthy and performing well.

#### 21. CCR Detail
| File | What it provides |
|------|-----------------|
| `commercial/ccr_autofollow_patterns.json` | Auto-follow pattern definitions. |
| `commercial/ccr_follower_info.json` | Per-index follower details: leader, remote cluster, parameters. |

**SA value**: The app reads `ccr_stats.json` for follower count. These files add the actual configuration detail (which indices follow which leaders).

#### 22. Enrich Statistics
| File | What it provides |
|------|-----------------|
| `commercial/enrich_stats.json` | Per-node enrich coordinator queue, remote requests, cache hit/miss/evictions. |

**SA value**: The app reads `enrich_policies.json` for count. Stats show whether enrichment is a bottleneck (high queue, cache misses).

#### 23. Rollup
| File | What it provides |
|------|-----------------|
| `commercial/rollup_jobs.json` | Rollup job definitions. |
| `commercial/rollup_caps.json` | Rollup capabilities by index. |
| `commercial/rollup_index_caps.json` | Per-index rollup capabilities. |

**SA value**: Rollup is a deprecated feature (replaced by downsampling). Presence indicates legacy configuration that may need migration.

#### 24. Logstash Centrally-Managed Pipelines **(self-hosted rich)**
| File | What it provides |
|------|-----------------|
| `commercial/logstash_pipeline.json` | Pipeline definitions stored in ES: inputs, filters, outputs. |

**SA value**: Self-hosted clusters may have dozens of centrally-managed Logstash pipelines (CPKC has 64). Shows the data ingestion architecture.

#### 25. Autoscaling
| File | What it provides |
|------|-----------------|
| `commercial/autoscaling_capacity.json` | Per-policy capacity decisions: current vs required. |

**SA value**: Cloud only. Shows whether autoscaling is triggered and what capacity changes are needed.

#### 26. Profiling
| File | What it provides |
|------|-----------------|
| `commercial/profiling_status.json` | Universal Profiling enabled/disabled, resource state, data presence. |

**SA value**: Niche — indicates whether Universal Profiling is deployed.

#### 27. Node Shutdown Status
| File | What it provides |
|------|-----------------|
| `commercial/nodes_shutdown_status.json` | Planned node shutdown/decommission requests. |

**SA value**: Niche — only relevant during maintenance windows.

#### 28. X-Pack Feature Usage
| File | What it provides |
|------|-----------------|
| `commercial/xpack.json` | Comprehensive feature usage: per-tier node/index/shard counts and sizes, analytics agg usage, security stats, monitoring stats, voting-only nodes, etc. |

**SA value**: Rich feature adoption overview. The per-tier breakdown (data_tiers section) provides an alternative source for tier sizing. Analytics section shows which aggregation types are used.

#### 29. Full Cluster State
| File | What it provides |
|------|-----------------|
| `cluster_state.json` | Complete cluster state: routing tables, metadata, blocks, node list. Very large. |

**SA value**: Contains routing table detail not available elsewhere. Mostly redundant with other files for high-level analysis. Useful for deep-dive allocation debugging.

#### 30. Cluster Settings Defaults
| File | What it provides |
|------|-----------------|
| `cluster_settings_defaults.json` | All settings including defaults. |

**SA value**: Only useful for auditing non-default settings (diff against defaults). Very large file.

#### 31. Unused Cat Files
| File | What it provides |
|------|-----------------|
| `cat/cat_allocation.txt` | Per-node disk allocation (text). Overlaps with `allocation.json`. |
| `cat/cat_count.txt` | Cluster doc count (text). Overlaps with `count.json`. |
| `cat/cat_fielddata.txt` | Fielddata per field (text). |
| `cat/cat_health.txt` | Cluster health (text). Overlaps with `cluster_health.json`. |
| `cat/cat_master.txt` | Master node (text). Overlaps with `master.json`. |
| `cat/cat_pending_tasks.txt` | Pending tasks (text). |
| `cat/cat_recovery.txt` | Recovery progress (text). |
| `cat/cat_repositories.txt` | Snapshot repos (text). |
| `cat/cat_segments.txt` | Segments (text). Very large. |
| `cat/cat_templates.txt` | Templates (text). |
| `cat/cat_thread_pool.txt` | Thread pool stats (text). |

**Note**: Most cat/ files have JSON equivalents already in the bundle. The exception is `cat_thread_pool.txt` which has no JSON equivalent — it's the only source of thread pool rejection data.

#### 32. Unused Kibana Files
| File | What it provides |
|------|-----------------|
| `kibana_actions.json` | Connectors (Slack, email, webhook, Jira, PagerDuty). |
| `kibana_alerts_1.json` | Alerting rules list (type, schedule, enabled state). |
| `kibana_detection_engine_rules_installed_1.json` | SIEM detection rules (count, types, enabled). |
| `kibana_detection_engine_rules_prebuilt_status.json` | Prebuilt rules: installed vs available. |
| `kibana_detection_engine_health_cluster.json` | Detection engine cluster health. |
| `kibana_detection_engine_health_space.json` | Detection engine space health. |
| `kibana_detection_engine_privileges.json` | Detection engine privilege check. |
| `kibana_fleet_agent_policies_1.json` | Agent policies: integrations per policy. |
| `kibana_fleet_agents_1.json` | Individual agent list with status/version. |
| `kibana_fleet_agents_current_upgrades.json` | Agents being upgraded. |
| `kibana_fleet_packages.json` | Installed integration packages. |
| `kibana_fleet_settings.json` | Fleet global settings. |
| `kibana_roles.json` | Security roles (ES + Kibana privileges). |
| `kibana_spaces.json` | Kibana spaces (name, disabled features). |
| `kibana_security_endpoint_metadata_1.json` | Enrolled Endpoint agents. |
| `kibana_security_endpoint_trusted_apps_1.json` | Trusted applications. |
| `kibana_security_endpoint_event_filters_1.json` | Event filters. |
| `kibana_security_endpoint_exception_items_1.json` | Endpoint exceptions. |
| `kibana_security_endpoint_host_isolation_1.json` | Host isolation exceptions. |
| `kibana_security_exception_list_1.json` | Exception list containers. |
| `kibana_security_packages.json` | Security integration packages. |
| `kibana_lists_privileges.json` | Exception list privileges. |
| `kibana_stats.json` | Instance process stats (heap, event loop, OS, requests). |
| `kibana_stack_monitoring_health.json` | Stack Monitoring health. |
| `kibana_synthetics_monitor_filters.json` | Synthetics monitor facets. |
| `kibana_synthetics_private_locations.json` | Synthetics private locations. |
| `kibana_uptime_locations.json` | Uptime locations. |
| `kibana_uptime_settings.json` | Uptime config. |
| `kibana_reporting_diagnose_browser.json` | Reporting browser diagnostics. |
| `kibana_user.json` | Authenticated user info. |
| `kibana_[manifests]` | Diagnostic manifests (2 files). |
| `space_*/kibana_alerts_1.json` | Per-space alerting rules. |
