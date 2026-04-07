/**
 * Lookup table for common embedding model dimensions.
 * Used to provide "Likely Model" hints when only dimensions are known (External models).
 */
export const DENSE_VECTOR_DIM_HINTS: Record<number, string> = {
  128: 'Cohere embed-v2 (small)',
  256: 'Cohere v4 / Google / OpenAI (trunc)',
  384: 'E5-small / MiniLM / BGE-small',
  512: 'Voyage-lite / OpenAI (trunc) / Google',
  768: 'E5-base / BGE-base / Google v4 / Nomic',
  1024: 'E5-large / Cohere v3 / Voyage / Mistral',
  1408: 'Google Multimodal',
  1536: 'OpenAI ada-002 / text-embedding-3-small / Voyage-code',
  2048: 'Cohere v2 (large) / Voyage',
  3072: 'OpenAI text-embedding-3-large / Voyage-3',
  4096: 'Llama-3 / Mistral-large',
}

/**
 * Returns a hint string for a given dimension count, or null if unknown.
 */
export function getModelHint(dims: number): string | null {
  return DENSE_VECTOR_DIM_HINTS[dims] || null
}

/**
 * Parses a model string like "External - Dense - 1536dims" and returns an enriched
 * label with the likely model hint if available.
 * e.g. "1536 (OpenAI ada-002 / small)"
 */
export function enrichModelLabel(modelId: string): string {
  const match = modelId.match(/^External - Dense - (\d+)dims$/)
  if (match) {
    const dims = parseInt(match[1], 10)
    const hint = getModelHint(dims)
    return hint ? `${dims} (${hint})` : `${dims} dims`
  }
  return modelId
}
