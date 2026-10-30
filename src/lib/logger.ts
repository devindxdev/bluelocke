import { sanitizeLog } from './log-sanitizer'
import { formatLogForDisplay } from './log-format'

const SCRIPTABLE_DIR = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents'
const DEFAULT_MAX_SIZE = 100

const loggingDateStringOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
} as Intl.DateTimeFormatOptions

export class Logger {
  private filepath: string
  private previousFilepath: string | undefined
  private maxSize: number
  private fm: FileManager

  constructor(filename: string, maxSize?: number) {
    this.filepath = `${SCRIPTABLE_DIR}/${filename}`
    this.previousFilepath = ''
    this.maxSize = maxSize || DEFAULT_MAX_SIZE
    this.fm = FileManager.iCloud()
  }

  private rotateFileIfNeeded() {
    if (this.fm.fileExists(this.filepath) && this.fm.fileSize(this.filepath) > this.maxSize) {
      this.redact(this.filepath)
      const date = new Date()
      const df = new DateFormatter()
      df.dateFormat = 'yyyyMMddHHmmssZ'
      this.previousFilepath = this.filepath.slice(0, this.filepath.length - 4) + '_' + df.string(date) + '.log'
      this.fm.move(this.filepath, this.previousFilepath)
    }
  }

  private formatLogEntry(data: string): string {
    const date = new Date()
    return `${date.toLocaleDateString(undefined, loggingDateStringOptions)} - ${data}`
  }

  private writeFile(data: string) {
    this.fm.writeString(this.filepath, data)
  }

  private readFile(filepath?: string): string {
    if (this.fm.fileExists(filepath || this.filepath)) return this.fm.readString(filepath || this.filepath)
    return ''
  }

  public log(input: unknown) {
    const entry = sanitizeLog(input)
    this.rotateFileIfNeeded()
    let currentData = this.readFile()
    currentData = sanitizeLog(currentData) + '\n' + this.formatLogEntry(entry)
    this.writeFile(currentData)
  }

  public clear() {
    if (this.previousFilepath && this.fm.fileExists(this.previousFilepath)) {
      this.fm.remove(this.previousFilepath)
    }
    if (this.fm.fileExists(this.filepath)) {
      this.fm.remove(this.filepath)
    }
    this.previousFilepath = ''
  }

  private redact(filepath: string): string {
    const raw = this.readFile(filepath)
    const sanitized = sanitizeLog(raw)
    if (raw !== sanitized) {
      try {
        this.fm.writeString(filepath, sanitized)
      } catch {
        // Sharing the sanitized output must still work with read-only storage.
      }
    }
    return sanitized
  }

  public read(): string {
    return this.readAndRedact()
  }

  public readAndRedact(): string {
    const contents = this.previousFilepath
      ? `${this.readFile(this.previousFilepath)}\n${this.readFile(this.filepath)}`
      : this.readFile(this.filepath)
    const sanitized = sanitizeLog(contents)
    if (this.previousFilepath) this.redact(this.previousFilepath)
    this.redact(this.filepath)
    return formatLogForDisplay(sanitized)
  }
}
