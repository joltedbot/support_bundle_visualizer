import { describe, it, expect } from 'vitest'
import { parsePendingTasks } from './pendingTasks'

describe('parsePendingTasks', () => {
  it('returns null when cluster_pending_tasks.json is absent', () => {
    expect(parsePendingTasks(new Map())).toBeNull()
  })

  it('returns empty task list when tasks array is empty', () => {
    const files = new Map([
      ['cluster_pending_tasks.json', JSON.stringify({ tasks: [] })],
    ])
    const result = parsePendingTasks(files)!
    expect(result.taskCount).toBe(0)
    expect(result.maxWaitMs).toBe(0)
    expect(result.tasks).toHaveLength(0)
  })

  it('clamps negative time_in_queue_millis to 0', () => {
    const files = new Map([
      ['cluster_pending_tasks.json', JSON.stringify({
        tasks: [
          { insert_order: 1, priority: 'HIGH', source: 'create-index [foo]', time_in_queue_millis: -500 },
        ],
      })],
    ])
    const result = parsePendingTasks(files)!
    expect(result.tasks[0].timeInQueueMs).toBe(0)
  })

  it('computes maxWaitMs from the task with the largest wait time', () => {
    const files = new Map([
      ['cluster_pending_tasks.json', JSON.stringify({
        tasks: [
          { insert_order: 1, priority: 'HIGH', source: 'reroute', time_in_queue_millis: 35000 },
          { insert_order: 2, priority: 'NORMAL', source: 'update-mapping', time_in_queue_millis: 12000 },
        ],
      })],
    ])
    const result = parsePendingTasks(files)!
    expect(result.taskCount).toBe(2)
    expect(result.maxWaitMs).toBe(35000)
  })
})
