import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  /** If set, the user must type this exact word to enable the confirm button. */
  requireText?: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export function ConfirmDialog({ open, title, children, confirmLabel, danger, requireText, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const blocked = Boolean(requireText) && typed.trim() !== requireText

  const close = () => {
    if (busy) return
    setTyped('')
    onClose()
  }

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setTyped('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      eyebrow={danger ? 'Please confirm' : undefined}
      width="max-w-md"
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={confirm}
            disabled={busy || blocked}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-soft">{children}</div>
      {requireText && (
        <label className="mt-5 block">
          <span className="label text-xs text-mute">
            Type <span className="text-white">{requireText}</span> to continue
          </span>
          <input className="input mt-2" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </label>
      )}
    </Modal>
  )
}
