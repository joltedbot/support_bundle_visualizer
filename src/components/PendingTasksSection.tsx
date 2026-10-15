import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiText,
  EuiAccordion,
  EuiSpacer,
} from '@elastic/eui'
import type { PendingTasksInfo } from '../parsers/types'
import type { BadgeColor } from '../theme/palette'
import { formatWaitTime } from '../utils/format'
import { PENDING_WAIT_WARN_MS, PENDING_WAIT_CRIT_MS } from '../utils/thresholds'

interface Props {
  pendingTasks: PendingTasksInfo
}

const PRIORITY_COLORS: Record<string, BadgeColor> = {
  IMMEDIATE: 'danger',
  URGENT:    'danger',
  HIGH:      'warning',
}

function priorityColor(priority: string): BadgeColor {
  return PRIORITY_COLORS[priority.toUpperCase()] ?? 'default'
}

function maxWaitColor(ms: number): 'danger' | 'warning' | 'subdued' {
  if (ms >= PENDING_WAIT_CRIT_MS) return 'danger'
  if (ms >= PENDING_WAIT_WARN_MS) return 'warning'
  return 'subdued'
}

export default function PendingTasksSection({ pendingTasks }: Props) {
  if (pendingTasks.taskCount === 0) return null

  const { taskCount, maxWaitMs, tasks } = pendingTasks
  const waitColor = maxWaitColor(maxWaitMs)
  const sorted = [...tasks].sort((a, b) => b.timeInQueueMs - a.timeInQueueMs)

  return (
    <div>
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiText size="s" color={waitColor}>
            <strong>{taskCount} pending cluster task{taskCount !== 1 ? 's' : ''}</strong>
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="s" color={waitColor}>
            · max wait {formatWaitTime(maxWaitMs)}
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiText size="xs" color="subdued" style={{ marginTop: 2, marginBottom: 6 }}>
        Pending tasks are queued cluster state updates waiting for the master node to process them. A high count or long wait indicates master node overload.
      </EuiText>

      {sorted.length > 0 && (
        <EuiAccordion
          id="pending-tasks-list"
          buttonContent={`Show ${sorted.length} task${sorted.length !== 1 ? 's' : ''}`}
          initialIsOpen={false}
          paddingSize="none"
        >
          <EuiSpacer size="xs" />
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '4px 12px', alignItems: 'baseline' }}>
            {sorted.map((task) => (
              <>
                <span key={`p-${task.insertOrder}`}>
                  <EuiBadge color={priorityColor(task.priority)} style={{ fontSize: 10 }}>
                    {task.priority}
                  </EuiBadge>
                </span>
                <EuiText key={`s-${task.insertOrder}`} size="xs" color="subdued"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {task.source}
                </EuiText>
                <EuiText key={`t-${task.insertOrder}`} size="xs" color="subdued"
                  style={{ whiteSpace: 'nowrap', textAlign: 'right' }}
                >
                  {formatWaitTime(task.timeInQueueMs)}
                </EuiText>
              </>
            ))}
          </div>
        </EuiAccordion>
      )}
    </div>
  )
}
