import type { KibanaInfo } from './types'

function parseJson(files: Map<string, string>, name: string): unknown {
  const raw = files.get(name)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function parseKibana(files: Map<string, string>): KibanaInfo | null {
  const status = parseJson(files, 'kibana_status.json')
  if (!isObj(status)) return null

  const version = typeof status.version === 'string'
    ? status.version
    : isObj(status.version) && typeof (status.version as Record<string,unknown>).number === 'string'
      ? (status.version as Record<string,unknown>).number as string
      : null
  if (!version) return null

  const instanceName = typeof status.name === 'string' ? status.name : ''
  const uuid = typeof status.uuid === 'string' ? status.uuid : ''

  // Status level → traffic-light
  const level = isObj(status.status) && isObj(status.status.overall)
    ? (status.status.overall as Record<string,unknown>).level
    : undefined
  const kibanaStatus: KibanaInfo['status'] =
    level === 'available' ? 'green'
    : level === 'degraded' ? 'yellow'
    : level === 'unavailable' || level === 'fatal' ? 'red'
    : 'unknown'

  // Process heap metrics (OS RAM is the host machine on ESS — not meaningful for instance size)
  let heapUsed: number | undefined
  let heapTotal: number | undefined
  let heapSizeLimit: number | undefined
  const metrics = isObj(status.metrics) ? status.metrics as Record<string,unknown> : null
  if (metrics) {
    const proc = isObj(metrics.process) ? metrics.process as Record<string,unknown> : null
    const procMem = proc && isObj(proc.memory) ? proc.memory as Record<string,unknown> : null
    const heap = procMem && isObj(procMem.heap) ? procMem.heap as Record<string,unknown> : null
    if (typeof heap?.used_in_bytes === 'number') heapUsed = heap.used_in_bytes
    if (typeof heap?.total_in_bytes === 'number') heapTotal = heap.total_in_bytes
    if (typeof heap?.size_limit === 'number') heapSizeLimit = heap.size_limit
  }

  // Alerting health
  let alertingHealth: KibanaInfo['alertingHealth'] = null
  let hasPermanentEncryptionKey: boolean | null = null
  const alerts = parseJson(files, 'kibana_alerts_health.json')
  if (isObj(alerts)) {
    if (typeof alerts.has_permanent_encryption_key === 'boolean') {
      hasPermanentEncryptionKey = alerts.has_permanent_encryption_key
    }
    const fwHealth = isObj(alerts.alerting_framework_health) ? alerts.alerting_framework_health as Record<string,unknown> : null
    const execHealth = fwHealth && isObj(fwHealth.execution_health) ? fwHealth.execution_health as Record<string,unknown> : null
    const execStatus = typeof execHealth?.status === 'string' ? execHealth.status : null
    alertingHealth = execStatus === 'ok' ? 'ok' : execStatus === 'warn' ? 'warn' : execStatus === 'error' ? 'error' : null
  }

  // Task Manager health
  let taskManagerStatus: KibanaInfo['taskManagerStatus'] = null
  const tm = parseJson(files, 'kibana_task_manager_health.json')
  if (isObj(tm) && typeof tm.status === 'string') {
    const s = tm.status
    taskManagerStatus = s === 'OK' ? 'OK' : s === 'warn' ? 'warn' : s === 'error' ? 'error' : null
  }

  // Fleet agent status
  let fleet: KibanaInfo['fleet'] = null
  const fleetStatus = parseJson(files, 'kibana_fleet_agent_status.json')
  if (isObj(fleetStatus) && isObj(fleetStatus.results)) {
    const r = fleetStatus.results as Record<string, unknown>
    const total = typeof r.all === 'number' ? r.all : 0
    fleet = {
      total,
      online:   typeof r.online   === 'number' ? r.online   : 0,
      offline:  typeof r.offline  === 'number' ? r.offline  : 0,
      error:    typeof r.error    === 'number' ? r.error    : 0,
      updating: typeof r.updating === 'number' ? r.updating : 0,
      inactive: typeof r.inactive === 'number' ? r.inactive : 0,
    }
  }

  // Fleet Settings
  let fleetSettings: KibanaInfo['fleetSettings'] = null
  const fleetSettingsJson = parseJson(files, 'kibana_fleet_settings.json')
  if (isObj(fleetSettingsJson)) {
    fleetSettings = {
      fleetServerHosts: Array.isArray(fleetSettingsJson.fleet_server_hosts) ? (fleetSettingsJson.fleet_server_hosts as string[]) : [],
      isConfigured: !!fleetSettingsJson.is_configured,
    }
  }

  // Fleet Policies
  const fleetPolicies: KibanaInfo['fleetPolicies'] = []
  const fleetPoliciesJson = parseJson(files, 'kibana_fleet_agent_policies_1.json')
  if (isObj(fleetPoliciesJson) && Array.isArray(fleetPoliciesJson.items)) {
    for (const item of fleetPoliciesJson.items) {
      if (!isObj(item)) continue
      const packagePolicies = Array.isArray(item.package_policies)
        ? item.package_policies
            .filter(isObj)
            .map(pp => (isObj(pp.package) ? String((pp.package as Record<string, unknown>).name || '') : ''))
            .filter(Boolean)
        : []

      fleetPolicies.push({
        name: String(item.name || ''),
        id: String(item.id || ''),
        agentCount: typeof item.agents_count === 'number' ? item.agents_count : 0,
        isManaged: !!item.is_managed,
        isPreconfigured: !!item.is_preconfigured,
        status: String(item.status || ''),
        updatedAt: String(item.updated_at || ''),
        version: String(item.version || ''),
        packagePolicies,
      })
    }
  }

  // Fleet Installed Packages
  const fleetInstalledPackages: KibanaInfo['fleetInstalledPackages'] = []
  const fleetPackagesJson = parseJson(files, 'kibana_fleet_packages.json')
  if (isObj(fleetPackagesJson) && Array.isArray(fleetPackagesJson.items)) {
    for (const item of fleetPackagesJson.items) {
      if (!isObj(item) || item.status !== 'installed') continue
      
      const name = String(item.name || '')
      const policyNames = fleetPolicies
        .filter(p => p.packagePolicies.includes(name))
        .map(p => p.name)

      fleetInstalledPackages.push({
        name,
        title: String(item.title || ''),
        version: String(item.version || ''),
        status: String(item.status || ''),
        policyNames,
      })
    }
  }

  // Data views
  let dataViews: string[] | undefined
  const dataViewsJson = parseJson(files, 'kibana_data_views.json')
  if (isObj(dataViewsJson) && Array.isArray(dataViewsJson.data_view)) {
    dataViews = (dataViewsJson.data_view as unknown[])
      .filter(isObj)
      .map(v => (typeof v.name === 'string' && v.name ? v.name : typeof v.title === 'string' ? v.title : ''))
      .filter(Boolean)
  }

  // Synthetics
  let synthetics: KibanaInfo['synthetics'] = null
  const synthJson = parseJson(files, 'kibana_synthetics_monitor_filters.json')
  if (isObj(synthJson)) {
    const monitorTypesRaw = Array.isArray(synthJson.monitorTypes) ? synthJson.monitorTypes : []
    const monitorTypes: string[] = monitorTypesRaw.map((t: unknown) =>
      typeof t === 'string' ? t : (t && typeof t === 'object' && 'label' in t) ? String((t as Record<string, unknown>).label) : ''
    ).filter(Boolean)
    const tags = Array.isArray(synthJson.tags) ? synthJson.tags : []
    const locations = Array.isArray(synthJson.locations) ? synthJson.locations : []
    const projects = Array.isArray(synthJson.projects) ? synthJson.projects : []
    
    if (monitorTypes.length > 0 || tags.length > 0 || locations.length > 0 || projects.length > 0) {
      synthetics = {
        projectCount: projects.length,
        monitorTypes,
        locationCount: locations.length,
        tagCount: tags.length,
      }
    }
  }

  return {
    version,
    instanceName,
    uuid,
    status: kibanaStatus,
    heapUsed,
    heapTotal,
    heapSizeLimit,
    alertingHealth,
    hasPermanentEncryptionKey,
    taskManagerStatus,
    fleet,
    fleetSettings,
    fleetPolicies,
    fleetInstalledPackages,
    synthetics,
    dataViews,
  }
}
