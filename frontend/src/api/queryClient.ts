/* The cache every server call shares.
 *
 * One instance for the whole app, created here rather than inside a component,
 * so a re-render can never build a second one and quietly throw the first away
 * along with everything in it.
 *
 * The defaults are deliberately close to TanStack Query's own. Two are worth
 * naming because later features depend on them:
 *
 * refetchOnWindowFocus stays on. It is what makes an account deactivated while
 * somebody was away stop working when they come back to the tab, rather than
 * whenever their eight hour token happens to run out.
 *
 * retry stays on for ordinary queries, because a dropped request is worth trying
 * again. The session query turns it off for itself in auth/useSitzung.ts, where
 * the reason is specific to that call.
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient()
