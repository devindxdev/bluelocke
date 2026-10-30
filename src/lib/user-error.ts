const DEFAULT_USER_ERROR = 'Unable to load your vehicle. Open Bluelocke in Scriptable to try again.'

// Only messages written for the user should reach widgets or Shortcut output.
// Request details and server responses belong in the sanitized diagnostic logs.
export class UserFacingError extends Error {
  constructor(public readonly publicMessage: string) {
    super(publicMessage)
    this.name = 'UserFacingError'
  }
}

export function getUserErrorMessage(error: unknown): string {
  return error instanceof UserFacingError ? error.publicMessage : DEFAULT_USER_ERROR
}
