import { describe, it, expect } from 'vitest'
import { parseIndices } from './indices'

function makeIndexLine(name: string): string {
  return `green  open   ${name.padEnd(60)} uuid1   1   1   100   0   1mb   500kb`
}

const HEADER = 'health status index                                                                        uuid                   pri rep docs.count docs.deleted store.size pri.store.size'

function makeFile(indexNames: string[]): string {
  return [HEADER, ...indexNames.map(makeIndexLine)].join('\n')
}

describe('parseIndices — indexType', () => {
  it('classifies a plain index as "index"', () => {
    const files = new Map([['cat/cat_indices.txt', makeFile(['my-index'])]])
    const result = parseIndices(files, new Set())
    expect(result[0].indexType).toBe('index')
  })

  it('classifies a .ds- prefixed index as "datastream-backing"', () => {
    const files = new Map([
      ['cat/cat_indices.txt', makeFile(['.ds-.fleet-actions-results-2026.05.01-000001'])],
    ])
    const result = parseIndices(files, new Set())
    expect(result[0].indexType).toBe('datastream-backing')
  })

  it('classifies an index in the alias set as "alias-backing"', () => {
    const files = new Map([['cat/cat_indices.txt', makeFile(['my-aliased-index'])]])
    const result = parseIndices(files, new Set(['my-aliased-index']))
    expect(result[0].indexType).toBe('alias-backing')
  })

  it('datastream-backing takes priority over alias-backing when both conditions are true', () => {
    const files = new Map([
      ['cat/cat_indices.txt', makeFile(['.ds-my-stream-000001'])],
    ])
    const result = parseIndices(files, new Set(['.ds-my-stream-000001']))
    expect(result[0].indexType).toBe('datastream-backing')
  })

  it('returns empty array when cat_indices.txt is absent', () => {
    const files = new Map<string, string>()
    const result = parseIndices(files, new Set())
    expect(result).toEqual([])
  })
})

describe('parseIndices — primaryStoreSizeBytes', () => {
  it('stores pri.store.size separately from store.size', () => {
    const files = new Map([['cat/cat_indices.txt', makeFile(['my-index'])]])
    const result = parseIndices(files, new Set())
    expect(result[0].storeSizeBytes).toBe(1024 * 1024)
    expect(result[0].primaryStoreSizeBytes).toBe(500 * 1024)
  })

  it('is 0 when the pri.store.size column is absent', () => {
    const header = 'health status index pri rep docs.count store.size'
    const files = new Map([['cat/cat_indices.txt', [header, 'green open my-index 1 1 100 1mb'].join('\n')]])
    expect(parseIndices(files, new Set())[0].primaryStoreSizeBytes).toBe(0)
  })
})
