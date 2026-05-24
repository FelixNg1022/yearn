import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { type Value } from 'react-phone-number-input'
import { PhoneInput } from './PhoneInput'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface Props {
  onClose: () => void
}

export function PhoneModal({ onClose }: Props) {
  const [phone, setPhone] = useState<Value | undefined>(undefined)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Close on backdrop click or Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch(`${API_URL}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json() as { ok?: boolean; smsUrl?: string; error?: string }
      if (!res.ok || !data.smsUrl) {
        setErrorMsg(data.error ?? 'something went wrong, try again')
        setStatus('error')
        return
      }
      window.location.href = data.smsUrl
    } catch {
      setErrorMsg('couldn\'t connect — check your connection and try again')
      setStatus('error')
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="close"
        >
          ×
        </button>

        <h2 className="text-xl font-semibold text-gray-900 mb-1">what's your number?</h2>
        <p className="text-sm text-gray-500 mb-5">we'll open iMessage so you can say hi ✨</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <PhoneInput
            value={phone}
            onChange={setPhone}
            disabled={status === 'loading'}
          />

          {errorMsg && (
            <p className="text-sm text-red-500">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !phone}
            className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors"
          >
            {status === 'loading' ? 'connecting…' : 'open iMessage →'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
