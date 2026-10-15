import { useMemo } from 'react'
import { useEuiTheme } from '@elastic/eui'

// Single source for component colours. Named EUI badge colours cover most badges;
// usePalette() resolves theme tokens to raw CSS values for dots, bars and borders,
// so colours follow the EuiProvider theme instead of hand-written hex.

export type BadgeColor = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'default'

/** Same colour for a solution wherever it is shown (Overview, Features & Integrations). */
export const SOLUTION_BADGE_COLORS: Record<string, BadgeColor> = {
  search: 'primary',
  observability: 'success',
  security: 'accent',
}

/** Maps a health-style level to a badge colour; anything unrecognised is neutral. */
export function levelBadgeColor(level: string | null | undefined): BadgeColor {
  switch (level) {
    case 'green':
    case 'ok':
    case 'OK':
      return 'success'
    case 'yellow':
    case 'warn':
      return 'warning'
    case 'red':
    case 'error':
      return 'danger'
    default:
      return 'default'
  }
}

export interface Palette {
  danger: string
  warning: string
  success: string
  primary: string
  accent: string
  neutral: string
  /** Subtle row background for blocked / failing rows. */
  dangerTint: string
  /** Node tier / role name to colour; look up with `?? tierFallback`. */
  tier: Record<string, string>
  tierFallback: string
  /** Index-list dots on the AI & ML tab. */
  dot: { agent: string; primary: string; sparse: string; semantic: string; system: string }
  /** ML memory stacked bar. */
  memBar: { track: string; anomalyDetection: string; inference: string; dataFrameAnalytics: string }
}

export function usePalette(): Palette {
  const { euiTheme } = useEuiTheme()
  return useMemo(() => {
    const c = euiTheme.colors
    const v = c.vis
    return {
      danger: c.danger,
      warning: c.warning,
      success: c.success,
      primary: c.primary,
      accent: c.accent,
      neutral: c.mediumShade,
      dangerTint: c.backgroundLightDanger,
      tier: {
        master: v.euiColorVis4,
        hot: v.euiColorVis6,
        warm: v.euiColorVis8,
        cold: v.euiColorVis2,
        frozen: v.euiColorVis0,
        coordinating: c.mediumShade,
        mixed: c.darkShade,
        ml: v.euiColorVis5,
        ingest: v.euiColorVis1,
        transform: v.euiColorVis9,
      },
      tierFallback: c.darkShade,
      dot: {
        agent: c.success,
        primary: c.primary,
        sparse: v.euiColorVis4,
        semantic: v.euiColorVis0,
        system: c.lightShade,
      },
      memBar: {
        track: c.lightShade,
        anomalyDetection: c.warning,
        inference: c.primary,
        dataFrameAnalytics: c.accent,
      },
    }
  }, [euiTheme])
}
