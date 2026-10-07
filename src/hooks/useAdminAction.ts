import { useCallback } from 'react'
import { useTournament } from '../context/TournamentContext'
import { useToast } from '../components/ui/Toast'

/**
 * Runs an admin write, refreshes the data, and reports success / failure as a toast.
 * Returns true on success so callers can close their dialogs.
 */
export function useAdminAction() {
  const { refresh } = useTournament()
  const toast = useToast()
  return useCallback(
    async (fn: () => Promise<void>, successMessage: string): Promise<boolean> => {
      try {
        await fn()
        await refresh()
        toast.success(successMessage)
        return true
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
        return false
      }
    },
    [refresh, toast],
  )
}
