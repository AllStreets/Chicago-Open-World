// app/src/services/chiApi.js — the CHI ATLAS API, used opportunistically (B.1.5): every call returns parsed JSON or
// null — never throws, never shows an error. No VITE_CHI_API_URL means no API: the guide runs on build-time data.
export function chiBase(env = import.meta.env) {
  return (env?.VITE_CHI_API_URL ?? '').replace(/\/+$/, '')
}

export async function chiGet(path, { timeoutMs = 4000, fetchImpl = globalThis.fetch, base = chiBase() } = {}) {
  if (!base || !fetchImpl) return null
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetchImpl(`${base}${path}`, { signal: ctl.signal, headers: { accept: 'application/json' } })
    if (!r?.ok) return null
    return await r.json()
  } catch {
    return null // timeout, network or CORS error, non-JSON body
  } finally {
    clearTimeout(timer)
  }
}
