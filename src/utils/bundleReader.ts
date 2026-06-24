export interface BundleData {
  files: Map<string, string>  // path → content
  rootName: string            // e.g. "api-diagnostics-20260319-211919"
}

/**
 * Parse a JSON file from the bundle. Returns null if missing or invalid.
 *
 * The cast to T is unsound — JSON.parse returns `any` and the shape is not
 * validated. Callers must treat all field accesses as potentially undefined
 * and use optional chaining throughout.
 */
export function parseJsonFile<T = unknown>(files: Map<string, string>, path: string): T | null {
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
