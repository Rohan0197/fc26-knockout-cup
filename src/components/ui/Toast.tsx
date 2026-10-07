import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

type Kind = 'success' | 'error'
interface ToastItem {
  id: number
  kind: Kind
  text: string
}

const Ctx = createContext<{ success: (t: string) => void; error: (t: string) => void } | null>(null)
let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: Kind, text: string) => {
    const id = ++counter
    setItems((s) => [...s, { id, kind, text }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 6500 : 3500)
  }, [])

  const api = useMemo(
    () => ({ success: (t: string) => push('success', t), error: (t: string) => push('error', t) }),
    [push],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25 }}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 border-l-2 bg-ink-800/95 px-4 py-3 text-sm shadow-xl backdrop-blur ${
                t.kind === 'success' ? 'border-pitch' : 'border-danger'
              }`}
            >
              {t.kind === 'success' ? (
                <CheckCircle2 size={18} className="mt-px shrink-0 text-pitch" />
              ) : (
                <AlertTriangle size={18} className="mt-px shrink-0 text-danger" />
              )}
              <span className="text-white">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast must be used inside <ToastProvider>')
  return v
}
