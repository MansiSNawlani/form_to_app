import { describe, expect, it } from 'vitest'
import type { Rolle } from '../api/typen'
import { sortierteRollen } from './rollen'

describe('sortierteRollen', () => {
  /* The whole reason this function exists. The database's order is not promised
     to be stable, so without it the same account could print its two roles one
     way round in the header and the other way round in the list. */
  it('prints the same roles the same way round whatever order they arrived in', () => {
    expect(sortierteRollen(['SUPER_ADMIN', 'SUBMITTER'])).toEqual(['SUBMITTER', 'SUPER_ADMIN'])
    expect(sortierteRollen(['SUBMITTER', 'SUPER_ADMIN'])).toEqual(['SUBMITTER', 'SUPER_ADMIN'])
  })

  it('keeps every role the account holds', () => {
    expect(sortierteRollen(['REVIEWER', 'DATA_STEWARD', 'SUBMITTER'])).toEqual([
      'SUBMITTER',
      'DATA_STEWARD',
      'REVIEWER',
    ])
  })

  it('has nothing to say about an account with no roles', () => {
    expect(sortierteRollen([])).toEqual([])
  })

  /* Only reachable against a backend newer than this build. A raw enum name has
     no label to print and no meaning to convey, so it is dropped rather than
     shown in the middle of a row. */
  it('drops a role this build has never heard of', () => {
    expect(sortierteRollen(['SUBMITTER', 'KURATOR' as Rolle])).toEqual(['SUBMITTER'])
  })
})
