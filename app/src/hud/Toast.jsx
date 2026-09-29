// app/src/hud/Toast.jsx — a short message that explains itself and goes away (e.g. "Sound is off — press M …").
import { useEffect } from 'react'
import { RiMusic2Line } from 'react-icons/ri'
import { useStore } from '../state/store.js'

export default function Toast() {
  const toast = useStore((s) => s.toast)
  useEffect(() => { if (!toast) return; const id = setTimeout(() => useStore.getState().clearToast(), 5000); return () => clearTimeout(id) }, [toast])
  if (!toast) return null
  return <div className="hud-chip toast" role="status"><RiMusic2Line aria-hidden="true" /><span>{toast.text}</span></div>
}
