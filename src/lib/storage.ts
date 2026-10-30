export function scriptStorageKey(kind: string, scope: string[] = []): string {
  return `bluelocke:${kind}:${JSON.stringify([Script.name(), ...scope])}`
}

export function removeKeychainValue(key: string): void {
  if (Keychain.contains(key)) Keychain.remove(key)
}
