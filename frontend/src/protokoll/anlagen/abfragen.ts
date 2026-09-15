/* The cached attachment list of one protocol.
 *
 * Added in feature 11e for the reviewer's page, which reads attachments and
 * cannot write one. The form's own blocks deliberately do not use this: they go
 * through useAnlagen, which owns an upload queue, per-file refusals and the
 * saving indicator, and none of that belongs to a page with no picker on it.
 *
 * Its own key rather than a field on the protocol's, for the reason
 * pruefung/abfragen.ts gives about the Verlauf: the answers and the attachments
 * change for different reasons and at different moments, and sharing an entry
 * would mean one throwing away the other.
 */

import { queryOptions } from '@tanstack/react-query'
import { sollWiederholen } from '../entwurf/abfragen'
import { listeAnlagen } from './api'

/** Namespaced by id, so two protocols never share an entry. */
export function anlagenKey(entwurfId: string) {
  return ['anlagen', entwurfId] as const
}

export function anlagenAbfrage(entwurfId: string | undefined) {
  return queryOptions({
    queryKey: anlagenKey(entwurfId ?? ''),
    queryFn: () =>
      entwurfId === undefined ? Promise.reject(new Error('no id')) : listeAnlagen(entwurfId),
    enabled: entwurfId !== undefined,
    retry: sollWiederholen,
  })
}
