import type { TrainedModel } from '../../parsers/types'
import { ML_MEM_WARN_PCT, ML_MEM_CRIT_PCT } from '../../utils/thresholds'

// ── Label helpers ─────────────────────────────────────────────────────────────

const MODEL_CLASS_LABELS: Record<string, string> = {
  elser: 'ELSER',
  e5: 'E5',
  dfa: 'DFA Model',
  nlp: 'NLP',
  lang_ident: 'Built-in',
}

export function modelClassLabel(m: TrainedModel): string {
  return MODEL_CLASS_LABELS[m.modelClass] ?? 'Model'
}

export function modelClassColor(m: TrainedModel): string {
  if (m.modelClass === 'lang_ident') return 'hollow'
  if (m.modelClass === 'dfa') return 'hollow'
  return 'primary'
}

export function stateColor(
  state: string,
): 'success' | 'danger' | 'warning' | 'default' {
  if (state === 'opened' || state === 'started') return 'success'
  if (state === 'failed') return 'danger'
  if (['opening', 'closing', 'starting', 'stopping'].includes(state))
    return 'warning'
  return 'default'
}

export function datafeedColor(
  datafeedState: string | null,
  jobState: string,
): 'success' | 'danger' | 'default' {
  if (!datafeedState) return 'default'
  if (datafeedState === 'started') return 'success'
  if (datafeedState === 'stopped' && jobState === 'opened') return 'danger'
  return 'default'
}

export function memoryStatusColor(
  status: string,
): 'success' | 'danger' | 'warning' | 'default' {
  if (status === 'ok') return 'success'
  if (status === 'hard_limit') return 'danger'
  if (status === 'soft_limit') return 'warning'
  return 'default'
}

// Intentional vis-palette hex: semantic status colors used as raw CSS backgrounds for the stacked bar
export function memBarColor(pct: number): string {
  if (pct >= ML_MEM_CRIT_PCT) return '#ff5630'
  if (pct >= ML_MEM_WARN_PCT) return '#ffab00'
  return '#36b37e'
}
