export interface BundleFile {
  path: string   // relative path within bundle, e.g. "cat/cat_nodes.txt"
  content: string
}

export interface BundleData {
  files: Map<string, string>  // path → content
  rootName: string            // e.g. "api-diagnostics-20260319-211919"
}

/**
 * Read a directory selected via File System Access API or input[type=file webkitdirectory].
 * Returns a BundleData with all files parsed as text.
 */
export async function readBundleFromFileList(fileList: FileList): Promise<BundleData> {
  const files = new Map<string, string>()
  let rootName = ''

  const items = Array.from(fileList)

  // Determine root folder name from first file's path
  if (items.length > 0) {
    const firstPath = items[0].webkitRelativePath
    rootName = firstPath.split('/')[0]
  }

  await Promise.all(
    items.map(async (file) => {
      const relativePath = file.webkitRelativePath
        .split('/')
        .slice(1) // remove root folder prefix
        .join('/')
      const content = await file.text()
      files.set(relativePath, content)
    })
  )

  return { files, rootName }
}

/**
 * Parse a JSON file from the bundle. Returns null if missing or invalid.
 */
export function parseJsonFile<T>(files: Map<string, string>, path: string): T | null {
  const content = files.get(path)
  if (!content) return null
  try {
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

/**
 * Get text file content from bundle. Returns null if missing.
 */
export function getTextFile(files: Map<string, string>, path: string): string | null {
  return files.get(path) ?? null
}
