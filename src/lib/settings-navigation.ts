import { getTable } from './scriptable-utils'

export interface SettingsNavigation {
  isRoot: boolean
  back: () => void
  refresh: () => void
  isCurrent: () => boolean
}

type Page = {
  render: (navigation: SettingsNavigation) => UITableRow[]
  resolve: () => void
}

type Session = { push: (render: Page['render']) => Promise<void> }
let activeSession: Session | undefined

// One native presentation for all Settings pages. Back changes the current
// page; Scriptable's Close dismisses the entire Settings presentation.
export async function presentSettingsPage(render: Page['render']): Promise<void> {
  if (activeSession) return activeSession.push(render)
  const { present, setState, getState, isTableActive } = getTable<{ revision: number }>({ name: 'Settings' })
  const pages: Page[] = [{ render, resolve: () => {} }]
  const refresh = () => {
    if (isTableActive()) setState({ revision: getState().revision + 1 })
  }
  const session: Session = {
    push: (render) =>
      new Promise<void>((resolve) => {
        pages.push({ render, resolve })
        refresh()
      }),
  }
  activeSession = session
  try {
    await present({
      defaultState: { revision: 0 },
      render: () => {
        const page = pages[pages.length - 1]!
        return page.render({
          isRoot: pages.length === 1,
          isCurrent: () => isTableActive() && pages[pages.length - 1] === page,
          refresh,
          back: () => {
            if (pages.length < 2 || pages[pages.length - 1] !== page) return
            pages.pop()
            refresh()
            page.resolve()
          },
        })
      },
    })
  } finally {
    if (activeSession === session) activeSession = undefined
    for (const page of pages.reverse()) page.resolve()
  }
}
