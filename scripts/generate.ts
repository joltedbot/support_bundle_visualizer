/**
 * Bundle data generator.
 * Reads an Elasticsearch diagnostic bundle from disk, parses it, and writes
 * src/generated/bundleData.ts for the static React app to import.
 *
 * Usage:
 *   npm run generate -- --customer <dirname> --name "Customer Name" [--notes "text"]
 *
 * The <dirname> must be a folder inside diagnostics/ containing:
 *   api-diagnostics-YYYYMMDD/         (required)
 *   kibana-api-diagnostics-YYYYMMDD/  (optional)
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { parseBundle } from '../src/parsers/index.ts'
import { parseKibana } from '../src/parsers/kibana.ts'
import type { BundleData } from '../src/utils/bundleReader.ts'

function checkUnzipAvailable(): void {
  const result = spawnSync('which', ['unzip'])
  if (result.error || result.status !== 0) {
    console.error('Error: unzip is required but not found — install it via your package manager (e.g. brew install unzip or apt install unzip)')
    process.exit(1)
  }
}

function getRootFolderFromZip(zipPath: string): string | null {
  try {
    const output = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf-8' })
    // Lines after the 3-line header contain entries; each ends with the archive path
    const lines = output.split('\n')
    for (const line of lines) {
      // Data lines match: spaces, length, date, time, then path
      const match = line.match(/^\s+\d+\s+\S+\s+\S+\s+(.+)$/)
      if (match) {
        const archivePath = match[1].trim()
        const rootFolder = archivePath.split('/')[0]
        if (rootFolder) return rootFolder
      }
    }
    return null
  } catch {
    return null
  }
}

function isSafeZip(zipPath: string, destDir: string): boolean {
  try {
    const output = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf-8' })
    const resolvedDest = resolve(destDir)
    for (const line of output.split('\n')) {
      const match = line.match(/^\s+\d+\s+\S+\s+\S+\s+(.+)$/)
      if (!match) continue
      const entryPath = match[1].trim()
      if (entryPath.startsWith('/')) return false
      if (entryPath.split('/').includes('..')) return false
      if (!resolve(resolvedDest, entryPath).startsWith(resolvedDest + sep)) return false
    }
    return true
  } catch {
    return false
  }
}

function extractZipsInDir(dirPath: string): number {
  let extracted = 0
  let entries: string[]
  try {
    entries = readdirSync(dirPath)
  } catch {
    return 0
  }

  const zips = entries.filter(e => e.toLowerCase().endsWith('.zip'))
  for (const zipName of zips) {
    const zipPath = join(dirPath, zipName)
    const rootFolder = getRootFolderFromZip(zipPath)
    if (!rootFolder) {
      console.warn(`  ↳ warning: could not read contents of ${zipName}, skipping`)
      continue
    }
    if (!isSafeZip(zipPath, dirPath)) {
      console.warn(`  ↳ warning: ${zipName} contains unsafe paths, skipping`)
      continue
    }
    if (existsSync(join(dirPath, rootFolder))) {
      console.log(`  ↳ skipping ${zipName} (already extracted as ${rootFolder})`)
    } else {
      console.log(`  ↳ extracting ${zipName} → ${rootFolder}`)
      try {
        execFileSync('unzip', ['-q', zipPath, '-d', dirPath])
        extracted++
      } catch {
        console.warn(`  ↳ warning: failed to extract ${zipName}, skipping`)
      }
    }
  }
  return extracted
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined
}

const customerDir = getArg('--customer')
const customerName = getArg('--name')
const clusterName = getArg('--cluster') ?? null
const notes = getArg('--notes') ?? null

if (!customerDir || !customerName) {
  console.error('Usage: npm run generate -- --customer <dirname> --name "Customer Name" [--cluster "Cluster Name"] [--notes "text"]')
  process.exit(1)
}

const root = process.cwd()
const diagnosticsBase = resolve(root, 'diagnostics')
const customerPath = resolve(diagnosticsBase, customerDir)

if (!customerPath.startsWith(diagnosticsBase + sep)) {
  console.error('Error: --customer must be a directory within diagnostics/')
  process.exit(1)
}

try {
  if (!statSync(customerPath).isDirectory()) {
    console.error(`Error: diagnostics/${customerDir} exists but is not a directory`)
    process.exit(1)
  }
} catch {
  console.error(`Error: diagnostics/${customerDir} does not exist`)
  process.exit(1)
}

type DeploymentMode =
  | { kind: 'single' }
  | { kind: 'multi'; deployments: string[] }
  | { kind: 'ambiguous' }

function detectDeploymentMode(customerPath: string): DeploymentMode {
  const entries = readdirSync(customerPath)
  const isDirAt = (base: string, name: string) => {
    try { return statSync(join(base, name)).isDirectory() } catch { return false }
  }

  const hasBundleAtTopLevel = entries.some(e =>
    (e.startsWith('api-diagnostics-') || e.startsWith('local-diagnostics-')) && isDirAt(customerPath, e)
  )

  if (hasBundleAtTopLevel) {
    return { kind: 'single' }
  }

  const subdirs = entries.filter(e => !e.startsWith('.') && isDirAt(customerPath, e))
  const deployments = subdirs.filter(sub => {
    const subPath = join(customerPath, sub)
    const subEntries = readdirSync(subPath)
    return subEntries.some(e =>
      (e.startsWith('api-diagnostics-') || e.startsWith('local-diagnostics-')) && isDirAt(subPath, e)
    )
  })

  if (deployments.length > 0) {
    return { kind: 'multi', deployments: deployments.sort() }
  }

  return { kind: 'ambiguous' }
}

function runBuild(): void {
  console.log('\nBuilding...')
  execFileSync('pnpm', ['run', 'build'], { cwd: root, stdio: 'inherit' })
}

interface DeploymentConfig {
  bundleParentPath: string
  customerName: string
  clusterName: string | null
  notes: string | null
  outputDir: string
}

function readDirRecursive(dir: string): Map<string, string> {
  const files = new Map<string, string>()
  const recurse = (current: string) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      const rel = relative(dir, full)
      try {
        if (statSync(full).isDirectory()) {
          recurse(full)
        } else {
          files.set(rel, readFileSync(full, 'utf-8'))
        }
      } catch {
        // skip unreadable or binary files
      }
    }
  }
  recurse(dir)
  return files
}

async function generateForDeployment(config: DeploymentConfig): Promise<void> {
  const isDirAt = (base: string, name: string) => {
    try { return statSync(join(base, name)).isDirectory() } catch { return false }
  }

  let entries: string[]
  try {
    entries = readdirSync(config.bundleParentPath)
  } catch {
    console.error(`Error: ${config.bundleParentPath} not found`)
    process.exit(1)
  }

  const esBundleName = entries.find(e => (e.startsWith('api-diagnostics-') || e.startsWith('local-diagnostics-')) && isDirAt(config.bundleParentPath, e))
  const kibanaBundleName = entries.find(e =>
    (e.startsWith('kibana-api-diagnostics-') || e.startsWith('kibana-local-diagnostics-')) &&
    isDirAt(config.bundleParentPath, e)
  )

  if (!esBundleName) {
    console.error(`Error: No api-diagnostics-* or local-diagnostics-* folder found in ${config.bundleParentPath}`)
    process.exit(1)
  }

  const esBundlePath = join(config.bundleParentPath, esBundleName)
  const files = readDirRecursive(esBundlePath)

  console.log(`Reading ${files.size} files from ${esBundleName}...`)

  const bundleData: BundleData = { files, rootName: esBundleName }
  const model = await parseBundle(bundleData)

  let kibana = null
  if (kibanaBundleName) {
    const kibanaPath = join(config.bundleParentPath, kibanaBundleName)
    const kibanaFiles = readDirRecursive(kibanaPath)
    console.log(`Reading ${kibanaFiles.size} files from ${kibanaBundleName}...`)
    kibana = parseKibana(kibanaFiles)
  }

  const output = {
    model,
    customerName: config.customerName,
    clusterName: config.clusterName,
    notes: config.notes,
    generatedAt: new Date().toISOString(),
    hasKibanaBundle: Boolean(kibanaBundleName),
    kibana,
  }

  const outDir = join(root, 'src', 'generated')
  mkdirSync(outDir, { recursive: true })

  // Write build config so vite.config.ts can set the correct output directory
  const pageTitle = config.clusterName
    ? `${config.customerName} — ${config.clusterName}`
    : config.customerName
  writeFileSync(
    join(outDir, 'buildConfig.json'),
    JSON.stringify({ customerDir: config.outputDir, pageTitle }, null, 2),
    'utf-8'
  )

  const outPath = join(outDir, 'bundleData.ts')
  const fileContent = [
    '// AUTO-GENERATED by `npm run generate` — do not edit manually',
    '// Contains customer data — do not commit or push',
    '',
    `export const bundleData = ${JSON.stringify(output, null, 2)}`,
    '',
  ].join('\n')

  writeFileSync(outPath, fileContent, 'utf-8')

  console.log(`\n✓ Generated src/generated/bundleData.ts`)
  console.log(`  Customer : ${config.customerName}`)
  console.log(`  ES bundle: ${esBundleName}`)
  console.log(`  Kibana   : ${kibanaBundleName ?? 'not found (optional)'}`)
  console.log(`  Notes    : ${config.notes ?? '(none)'}`)
  console.log(`  Output   : ${config.outputDir}`)
}

checkUnzipAvailable()

console.log('Checking for zip files to extract...')
let totalExtracted = 0

totalExtracted += extractZipsInDir(customerPath)

for (const entry of readdirSync(customerPath)) {
  const sub = join(customerPath, entry)
  try {
    if (!entry.startsWith('.') && statSync(sub).isDirectory()) {
      totalExtracted += extractZipsInDir(sub)
    }
  } catch {
    // skip unreadable entries
  }
}

if (totalExtracted > 0) {
  console.log(`✓ Extracted ${totalExtracted} zip file(s)\n`)
} else {
  console.log('  No new zips to extract\n')
}

const mode = detectDeploymentMode(customerPath)

if (mode.kind === 'ambiguous') {
  console.error(
    `Error: No diagnostic bundles found in diagnostics/${customerDir}/.\n` +
    `Expected either api-diagnostics-*/local-diagnostics-* directly in the directory,\n` +
    `or subdirectories that each contain api-diagnostics-*/local-diagnostics-*.\n` +
    `Please check the directory structure.`
  )
  process.exit(1)
}

if (mode.kind === 'single') {
  await generateForDeployment({
    bundleParentPath: customerPath,
    customerName,
    clusterName,
    notes,
    outputDir: customerDir,
  })
  console.log(`\nNext step: pnpm run build`)
} else {
  console.log(`Found ${mode.deployments.length} deployments for ${customerName}:\n`)
  for (const dep of mode.deployments) {
    console.log(`  • ${dep}`)
  }
  console.log('')

  for (const dep of mode.deployments) {
    const deploymentClusterName = dep.replace(/-/g, ' ')
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Processing deployment: ${dep}`)
    console.log(`${'='.repeat(60)}`)

    await generateForDeployment({
      bundleParentPath: join(customerPath, dep),
      customerName,
      clusterName: deploymentClusterName,
      notes,
      outputDir: `${customerDir}/${dep}`,
    })

    runBuild()
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✓ All ${mode.deployments.length} deployments processed.`)
  console.log(`Reports are in output/${customerDir}/`)
  console.log(`${'='.repeat(60)}`)
}
