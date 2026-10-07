/// <reference lib="dom" />

export interface BitunixCredentials {
  apiKey: string
  apiSecret: string
}

interface CredentialVaultV1 {
  version: 1
  algorithm: 'AES-GCM'
  kdf: 'PBKDF2-SHA-256'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

const ITERATIONS = 600_000
function encodeText(value: string): Uint8Array {
  const escaped = encodeURIComponent(value)
  const bytes: number[] = []
  for (let index = 0; index < escaped.length; index += 1) {
    if (escaped[index] === '%') {
      bytes.push(Number.parseInt(escaped.slice(index + 1, index + 3), 16))
      index += 2
    } else bytes.push(escaped.charCodeAt(index))
  }
  return new Uint8Array(bytes)
}

function decodeText(bytes: Uint8Array): string {
  return decodeURIComponent(Array.from(bytes, byte => `%${byte.toString(16).padStart(2, '0')}`).join(''))
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(value: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[a-f\d]*$/i.test(value)) throw new RangeError('Bóveda cifrada inválida.')
  return Uint8Array.from({ length: value.length / 2 }, (_, index) => Number.parseInt(value.slice(index * 2, index * 2 + 2), 16))
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.buffer
}

async function deriveKey(password: string, salt: Uint8Array) {
  const material = await window.crypto.subtle.importKey('raw', asArrayBuffer(encodeText(password)), 'PBKDF2', false, ['deriveKey'])
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: asArrayBuffer(salt), iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypt the credentials for browser-local storage; the password is never stored. */
export async function encryptCredentials(credentials: BitunixCredentials, password: string): Promise<string> {
  if (password.length < 12) throw new RangeError('La contraseña de cifrado debe tener al menos 12 caracteres.')
  if (!credentials.apiKey.trim() || !credentials.apiSecret.trim()) throw new RangeError('Introduce API key y API secret.')
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const plaintext = encodeText(JSON.stringify({ apiKey: credentials.apiKey, apiSecret: credentials.apiSecret }))
  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: asArrayBuffer(iv) }, key, asArrayBuffer(plaintext))
  const vault: CredentialVaultV1 = {
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: ITERATIONS,
    salt: toHex(salt),
    iv: toHex(iv),
    ciphertext: toHex(new Uint8Array(ciphertext)),
  }
  return JSON.stringify(vault)
}

/** Decrypt a browser-local vault. Wrong passwords and modified data fail closed. */
export async function decryptCredentials(serializedVault: string, password: string): Promise<BitunixCredentials> {
  const vault = JSON.parse(serializedVault) as Partial<CredentialVaultV1>
  if (vault.version !== 1 || vault.algorithm !== 'AES-GCM' || vault.kdf !== 'PBKDF2-SHA-256'
      || vault.iterations !== ITERATIONS || !vault.salt || !vault.iv || !vault.ciphertext) {
    throw new RangeError('El archivo local de credenciales no tiene un formato válido.')
  }
  const key = await deriveKey(password, fromHex(vault.salt))
  const plaintext = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(fromHex(vault.iv)) }, key, asArrayBuffer(fromHex(vault.ciphertext)),
  )
  const credentials = JSON.parse(decodeText(new Uint8Array(plaintext))) as Partial<BitunixCredentials>
  if (typeof credentials.apiKey !== 'string' || typeof credentials.apiSecret !== 'string') {
    throw new RangeError('El contenido local de credenciales no es válido.')
  }
  return { apiKey: credentials.apiKey, apiSecret: credentials.apiSecret }
}
