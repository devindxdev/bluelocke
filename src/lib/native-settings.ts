import { quickOptions, confirm } from './scriptable-utils'
import { FormOpts, Editing, FormStateShape, FieldOpts, FieldType } from './scriptable-utils/input/form/types'
import { appHeader, appNavigation, appListRow, appSpace, appCaption, appSection, appSeparator } from './app-ui'
import { presentSettingsPage, SettingsNavigation } from './settings-navigation'
import { getAppLogger } from './util'
import { sanitizeLog } from './log-sanitizer'

type SettingsFormOpts<T extends FormStateShape> = Omit<FormOpts<T>, 'onSubmit' | 'submitButtonText'> & {
  onChange?: (changes: Editing<T>, values: Editing<T>) => void | Promise<void>
  allowIncomplete?: boolean
  initialSetup?: boolean
}

// Each confirmed field edit commits only the changed values. Navigating away
// never submits an old page's snapshot over settings saved elsewhere.
export function settingsForm<T extends FormStateShape>(opts: SettingsFormOpts<T>) {
  return async (initial: Editing<T> = {}) => {
    let values = Object.fromEntries(Object.keys(opts.fields).map((key) => [key, initial[key]])) as Editing<T>
    let navigation: SettingsNavigation | undefined
    let editing = false
    let changed = false

    const errorFor = (key: keyof T, next: Editing<T>): string | undefined => {
      const field = opts.fields[key]
      const value = next[key]
      if (field.isRequired && (value === undefined || value === null || (typeof value === 'string' && !value.trim()))) {
        return `${field.label ?? String(key)} is required.`
      }
      const error = field.getErrorMessage?.(next)
      if (error) return error
      if (!opts.allowIncomplete && opts.isFormValid?.(next) === false) return 'Choose a valid value.'
      return undefined
    }

    const change = async (key: keyof T, value: any): Promise<boolean> => {
      if (!navigation?.isCurrent()) return false
      const previous = values
      const draft = { ...values, [key]: value }
      const next = opts.onStateChange?.(draft, previous) ?? draft
      const changes = Object.fromEntries(
        Object.keys(opts.fields)
          .filter((key) => next[key] !== previous[key])
          .map((key) => [key, next[key]]),
      ) as Editing<T>
      if (!Object.keys(changes).length) return true
      try {
        await opts.onChange?.(changes, next)
      } catch (error) {
        try {
          getAppLogger().log(`Could not save setting ${String(key)}: ${sanitizeLog(error)}`)
        } catch {
          // A logging/storage failure must not hide the recovery message.
        }
        await confirm('Could not save this change', {
          message: 'Your previous setting is still in use. Please try again.',
          includeCancel: false,
        })
        return false
      }
      values = next
      changed = true
      if (navigation.isCurrent()) navigation.refresh()
      return true
    }

    const edit = async (key: keyof T, field: FieldOpts<FieldType, T, keyof T>) => {
      if (editing) return
      editing = true
      try {
        const current = values[key]
        if (field.type === 'clickable') {
          await field.onClickFunction?.(field.onClickFunctionData)
          if (navigation?.isCurrent()) navigation.refresh()
          return
        }
        if (field.type === 'checkbox') {
          await change(key, !current)
          return
        }
        if (field.type === 'dropdown') {
          const options = (field.options ?? []) as (string | number)[]
          const selected = await quickOptions(
            options.map((value) => ({
              label: `${value === current ? '✓ ' : ''}${field.mapDisplayValue?.(String(value)) ?? String(value)}`,
              value,
            })),
            { title: field.label },
          )
          if (selected !== null) await change(key, selected)
          return
        }
        if (field.type === 'textInput' || field.type === 'numberValue') {
          let inputValue = String(current ?? '')
          let message: string | undefined
          while (navigation?.isCurrent()) {
            const alert = new Alert()
            alert.title = field.label ?? String(key)
            if (message) alert.message = message
            const input = field.secure ? alert.addSecureTextField('', inputValue) : alert.addTextField('', inputValue)
            if (field.type === 'numberValue' || field.flavor === 'number') input.setDecimalPadKeyboard()
            else if (field.flavor === 'email') input.setEmailAddressKeyboard()
            alert.addAction('Done')
            alert.addCancelAction('Cancel')
            if ((await alert.presentAlert()) < 0) return
            inputValue = alert.textFieldValue(0)
            const text = inputValue.trim()
            // Preserve intentional whitespace in passwords.
            const value =
              field.type === 'numberValue' ? (text === '' ? undefined : Number(text)) : field.secure ? inputValue : text
            message =
              field.type === 'numberValue' && (typeof value !== 'number' || !Number.isFinite(value))
                ? 'Enter a number.'
                : errorFor(key, { ...values, [key]: value })
            if (message) continue
            if (await change(key, value)) return
          }
        }
      } finally {
        editing = false
      }
    }

    await presentSettingsPage((nav) => {
      navigation = nav
      const valid = opts.isFormValid?.(values) ?? true
      const result: UITableRow[] = [
        appNavigation(nav, {
          rootAction: opts.initialSetup ? 'Continue' : 'Done',
          enabled: !opts.initialSetup || valid,
        }),
        appHeader(opts.title),
        appCaption(opts.subtitle ?? 'Changes save automatically.'),
        appSpace(),
      ]
      let section: string | undefined
      for (const key of Object.keys(opts.fields) as (keyof T)[]) {
        const field = opts.fields[key]
        if (field.shouldHide?.(values)) continue
        if (field.section && field.section !== section) {
          section = field.section
          result.push(appSection(section))
        }
        const value = values[key]
        const formatted =
          field.type === 'clickable'
            ? '›'
            : field.type === 'checkbox'
              ? value
                ? 'On'
                : 'Off'
              : field.secure && value
                ? '••••••••'
                : value === undefined || value === null || value === ''
                  ? field.isRequired
                    ? 'Not set'
                    : 'Default'
                  : (field.mapDisplayValue?.(String(value)) ?? String(value))
        result.push(
          appListRow(field.label ?? String(key), {
            ...(formatted.length > 16 && !field.secure ? { subtitle: formatted, value: '›' } : { value: formatted }),
            onSelect: () => edit(key, field),
          }),
          appSeparator(),
        )
      }
      result.push(appSpace())
      return result
    })
    return { formState: values, isValid: opts.isFormValid?.(values) ?? true, changed }
  }
}
