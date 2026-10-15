import React from 'react'
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiListGroup,
  EuiListGroupItem,
  EuiPanel,
  EuiText,
  EuiTitle,
  EuiSpacer,
} from '@elastic/eui'

export function IndexNameList({
  names,
  dotColor = '#4c9aff',
}: {
  names: string[]
  dotColor?: string
}) {
  const userNames = names.filter((n) => !n.startsWith('.')).sort()
  const systemNames = names.filter((n) => n.startsWith('.')).sort()
  const bothGroups = userNames.length > 0 && systemNames.length > 0

  const renderItems = (items: string[], isSystem: boolean) =>
    items.map((name) => (
      <EuiListGroupItem
        key={name}
        size="xs"
        color={isSystem ? 'subdued' : 'text'}
        label={<code>{name}</code>}
        icon={<Dot color={isSystem ? '#444c60' : dotColor} />}
        wrapText
      />
    ))

  return (
    <div style={{ marginTop: 6 }}>
      {userNames.length > 0 && (
        <>
          {bothGroups && (
            <EuiText size="xs" color="subdued" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
              User
            </EuiText>
          )}
          <EuiListGroup flush gutterSize="none">
            {renderItems(userNames, false)}
          </EuiListGroup>
        </>
      )}
      {systemNames.length > 0 && (
        <>
          {bothGroups && (
            <EuiText size="xs" color="subdued" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8, marginBottom: 2 }}>
              System
            </EuiText>
          )}
          <EuiListGroup flush gutterSize="none">
            {renderItems(systemNames, true)}
          </EuiListGroup>
        </>
      )}
    </div>
  )
}

export const Dot = ({ color }: { color: string }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color,
      marginRight: 6,
      flexShrink: 0,
      marginTop: 3,
    }}
  />
)

export const Pill = ({
  dotColor,
  title,
  subtitle,
}: {
  dotColor: string
  title: string
  subtitle: string
}) => (
  <EuiPanel
    hasShadow={false}
    paddingSize="s"
    style={{ marginBottom: 6 }}
  >
    <EuiFlexGroup gutterSize="s" alignItems="flexStart" responsive={false}>
      <EuiFlexItem grow={false}>
        <Dot color={dotColor} />
      </EuiFlexItem>
      <EuiFlexItem>
        <EuiText size="s">{title}</EuiText>
        <EuiText size="xs" color="subdued">{subtitle}</EuiText>
      </EuiFlexItem>
    </EuiFlexGroup>
  </EuiPanel>
)

export const SubSection = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <EuiFlexItem style={{ minWidth: 220 }}>
    <EuiTitle size="xxs"><h4>{title}</h4></EuiTitle>
    <EuiSpacer size="s" />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {children}
    </div>
  </EuiFlexItem>
)
