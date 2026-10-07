import { afterAll, describe, expect, it, vi } from 'vitest'
import { decryptCredentials, encryptCredentials } from '../src/lib/credentialVault'

vi.stubGlobal('window', { crypto: Reflect.get(globalThis, 'crypto') })
afterAll(() => vi.unstubAllGlobals())

describe('browser credential vault', () => {
  it('encrypts credentials at rest and restores them with the passphrase', async () => {
    const credentials = { apiKey: 'example-api-key', apiSecret: 'example-api-secret' }
    const vault = await encryptCredentials(credentials, 'a-strong-local-passphrase')
    expect(vault).not.toContain(credentials.apiKey)
    expect(vault).not.toContain(credentials.apiSecret)
    await expect(decryptCredentials(vault, 'a-strong-local-passphrase')).resolves.toEqual(credentials)
  })

  it('rejects an incorrect passphrase', async () => {
    const vault = await encryptCredentials({ apiKey: 'key', apiSecret: 'secret' }, 'a-strong-local-passphrase')
    await expect(decryptCredentials(vault, 'a-different-passphrase')).rejects.toThrow()
  })

  it('requires a non-trivial passphrase and both credentials', async () => {
    await expect(encryptCredentials({ apiKey: 'key', apiSecret: 'secret' }, 'short')).rejects.toThrow('12 caracteres')
    await expect(encryptCredentials({ apiKey: '', apiSecret: 'secret' }, 'a-strong-local-passphrase')).rejects.toThrow('API key')
  })
})
