import { parseJsonFile } from '../utils/bundleReader'
import type { PendingTasksInfo, PendingTask } from './types'

interface PendingTasksJson {
  tasks?: Array<{
    insert_order?: number
    priority?: string
    source?: string
    time_in_queue_millis?: number
  }>
}

export function parsePendingTasks(files: Map<string, string>): PendingTasksInfo | null {
  const raw = parseJsonFile<PendingTasksJson>(files, 'cluster_pending_tasks.json')
  if (!raw) return null

  const tasks: PendingTask[] = (raw.tasks ?? []).map((t) => ({
    insertOrder: t.insert_order ?? 0,
    priority: t.priority ?? 'UNKNOWN',
    source: t.source ?? '',
    timeInQueueMs: Math.max(0, t.time_in_queue_millis ?? 0),
  }))

  const maxWaitMs = tasks.reduce((acc, t) => Math.max(acc, t.timeInQueueMs), 0)

  return { taskCount: tasks.length, maxWaitMs, tasks }
}
