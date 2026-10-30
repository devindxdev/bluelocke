import { OK } from './input/confirm'
import PersistedLog from './io/PersistedLog'
import { sanitizeLog } from '../log-sanitizer'

export const alertAndLogError = (error: any, context: string) => {
  OK(`Error in ${context} (see log)`, { message: sanitizeLog(error) })
  PersistedLog().log({ type: 'Error', error: sanitizeLog(error) })
}
