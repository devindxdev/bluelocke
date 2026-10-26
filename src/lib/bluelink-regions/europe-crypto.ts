import { Buffer } from 'buffer'

export interface RsaPublicKeyJwk {
  n: string
  e: string
  kid?: string
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n
  let current = base % modulus
  while (exponent > 0n) {
    if (exponent & 1n) result = (result * current) % modulus
    exponent >>= 1n
    current = (current * current) % modulus
  }
  return result
}

function randomPadding(length: number): Uint8Array {
  const padding: number[] = []
  while (padding.length < length) {
    const bytes = Buffer.from(UUID.string().replaceAll('-', ''), 'hex')
    for (let index = 0; index < bytes.length && padding.length < length; index++) {
      if (index !== 6 && index !== 8 && bytes[index]) padding.push(bytes[index]!)
    }
  }
  return new Uint8Array(padding)
}

export function encryptPasswordWithRsaJwk(password: string, jwk: RsaPublicKeyJwk): string {
  if (!jwk.n || !jwk.e) throw Error('Hyundai login certificate is missing its RSA key.')
  const modulusBytes = Buffer.from(jwk.n.replaceAll('-', '+').replaceAll('_', '/'), 'base64')
  const modulus = BigInt(`0x${modulusBytes.toString('hex') || '0'}`)
  const exponent = BigInt(
    `0x${Buffer.from(jwk.e.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('hex') || '0'}`,
  )
  if (modulus <= 0n || exponent <= 1n || !(exponent & 1n))
    throw Error('Hyundai login certificate has an invalid RSA key.')
  const message = Buffer.from(password, 'utf8')
  const length = Math.ceil(modulus.toString(2).length / 8)
  if (message.length > length - 11) throw Error('Password is too long for the Hyundai login certificate.')
  const block = Buffer.concat([
    Buffer.from([0, 2]),
    Buffer.from(randomPadding(length - message.length - 3)),
    Buffer.from([0]),
    message,
  ])
  return modPow(BigInt(`0x${block.toString('hex')}`), exponent, modulus)
    .toString(16)
    .padStart(length * 2, '0')
}
