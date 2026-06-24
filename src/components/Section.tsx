import type { ReactNode } from 'react'
import { EuiSpacer, EuiTitle } from '@elastic/eui'

interface SectionProps {
  title: string
  show: boolean
  children: ReactNode
}

export function Section({ title, show, children }: SectionProps) {
  if (!show) return null
  return (
    <>
      <EuiSpacer size="l" />
      <EuiTitle size="s"><h3>{title}</h3></EuiTitle>
      <EuiSpacer size="s" />
      {children}
    </>
  )
}
