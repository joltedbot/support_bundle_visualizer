import { parseJsonFile } from '../utils/bundleReader'
import type { IdentityInfo, IdentityProvider } from './types'

interface NodesJson {
  nodes?: Record<string, {
    settings?: Record<string, unknown>
  }>
}

interface SecurityUsersJson {
  [username: string]: {
    metadata?: {
      _reserved?: boolean
    }
  }
}

export function parseAuth(files: Map<string, string>): IdentityInfo | null {
  const usersRaw = parseJsonFile<SecurityUsersJson>(files, 'commercial/security_users.json')
  const nodesRaw = parseJsonFile<NodesJson>(files, 'nodes.json')

  if (!usersRaw && !nodesRaw) return null

  let nativeUserCount = 0
  let reservedUserCount = 0
  if (usersRaw) {
    for (const user of Object.values(usersRaw)) {
      if (user.metadata?._reserved === true) {
        reservedUserCount++
      } else {
        nativeUserCount++
      }
    }
  }

  const providers: IdentityProvider[] = []
  if (nodesRaw?.nodes) {
    // Look at the first node's settings (they should be identical for security config)
    const firstNode = Object.values(nodesRaw.nodes)[0]
    const xpack = firstNode?.settings?.xpack as Record<string, unknown> | undefined
    const security = xpack?.security as Record<string, unknown> | undefined
    const authc = security?.authc as Record<string, unknown> | undefined
    const realms = authc?.realms as Record<string, unknown> | undefined

    if (realms && typeof realms === 'object') {
      for (const [type, typeRealms] of Object.entries(realms)) {
        if (!typeRealms || typeof typeRealms !== 'object') continue

        for (const [name, configRaw] of Object.entries(typeRealms as Record<string, unknown>)) {
          // Skip Cloud-internal and native (native shown as user count)
          if (name === 'cloud-saml-kibana' || name === 'found' || type === 'native' || type === 'file') {
            continue
          }

          const config = configRaw as Record<string, unknown> | undefined
          if (!config) continue

          let label = `${type.toUpperCase()} · ${name}`
          if (type === 'saml') {
            const idp = config.idp as Record<string, unknown> | undefined
            const idpMetadata = idp?.metadata as Record<string, unknown> | undefined
            const metadata = (idpMetadata?.path as string | undefined) || (idp?.entity_id as string | undefined)
            if (metadata) {
              const domain = metadata.match(/https?:\/\/([^/]+)/)?.[1] || metadata
              label = `SAML · ${domain}`
            }
          } else if (type === 'active_directory') {
            const domain = config.domain_name as string | undefined
            if (domain) label = `AD · ${domain}`
          } else if (type === 'ldap') {
            const url = Array.isArray(config.url) ? config.url[0] : config.url as string | undefined
            if (url) label = `LDAP · ${url}`
          } else if (type === 'oidc') {
            const op = config.op as Record<string, unknown> | undefined
            const issuer = op?.issuer as string | undefined
            if (issuer) label = `OIDC · ${issuer}`
          }

          providers.push({ type, name, label })
        }
      }
    }
  }

  if (nativeUserCount === 0 && providers.length === 0) return null

  return {
    nativeUserCount,
    reservedUserCount,
    providers
  }
}
