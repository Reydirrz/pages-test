/// <reference lib="dom" />

import type { BitunixCredentials } from './credentialVault'

function asBytes(value: string): ArrayBuffer {
  const encoded = encodeURIComponent(value)
  const bytes: number[] = []
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16))
      index += 2
    } else bytes.push(encoded.charCodeAt(index))
  }
  return new Uint8Array(bytes).buffer
}

async function sha256(value: string): Promise<string> {
  const digest = await window.crypto.subtle.digest('SHA-256', asBytes(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Direct browser attempt. Bitunix CORS must allow the signed headers for this to work. */
export async function fetchBitunixPositionsInBrowser(credentials: BitunixCredentials): Promise<unknown> {
  const nonceBytes = window.crypto.getRandomValues(new Uint8Array(16))
  const nonce = Array.from(nonceBytes, byte => byte.toString(16).padStart(2, '0')).join('')
  const timestamp = String(Date.now())
  const digest = await sha256(`${nonce}${timestamp}${credentials.apiKey}`)
  const sign = await sha256(`${digest}${credentials.apiSecret}`)
  const response = await fetch('https://fapi.bitunix.com/api/v1/futures/position/get_pending_positions', {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    headers: {
      'api-key': credentials.apiKey,
      nonce,
      timestamp,
      sign,
      language: 'en-US',
      'Content-Type': 'application/json',
    },
  })
  const payload = await response.json()
  if (!response.ok || payload.code !== 0) throw new Error(payload.msg || `Bitunix respondió HTTP ${response.status}.`)
  return payload
}
