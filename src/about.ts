import { getTable, Div, P, Spacer, quickOptions, OK } from 'lib/scriptable-utils'
import { GithubRelease, Version } from 'lib/version'
import { getAppLogger, getSiriLogger } from './lib/util'
import {
  Bluelink,
  getBluelinkLogger,
  getBluelinkResponseLogger,
  queueNextApiResponseCapture,
} from 'lib/bluelink-regions/base'
import { getWidgetLogger } from 'widget'

const SCRIPTABLE_DIR = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents'
const logger = getAppLogger()
const DEBUG_LOG_SECTIONS = [
  'Shortcut Logs',
  'App Logs',
  'Widget Logs',
  'Bluelink API Logs',
  'Bluelink API Responses',
] as const
type DebugLogSection = (typeof DEBUG_LOG_SECTIONS)[number]
type DebugViewerAction = 'share-api-response' | 'close'

function getDebugLogContents(section: DebugLogSection): string {
  switch (section) {
    case 'Shortcut Logs':
      return getSiriLogger().readAndRedact() || 'No shortcut logs yet.'
    case 'App Logs':
      return getAppLogger().readAndRedact() || 'No app logs yet.'
    case 'Widget Logs':
      return getWidgetLogger().readAndRedact() || 'No widget logs yet.'
    case 'Bluelink API Logs':
      return getBluelinkLogger().readAndRedact() || 'No API logs yet.'
    case 'Bluelink API Responses':
      return (
        getBluelinkResponseLogger().readAndRedact() ||
        'No API response snapshots yet. Turn on debug logging, reproduce the issue, then try again.'
      )
  }
}

function getAllDebugLogs(): string[] {
  return [
    'Bluelink API logs:',
    getDebugLogContents('Bluelink API Logs'),
    'Bluelink API responses:',
    getDebugLogContents('Bluelink API Responses'),
    'Widget Logs',
    getDebugLogContents('Widget Logs'),
    'App Logs',
    getDebugLogContents('App Logs'),
    'Shortcut Logs',
    getDebugLogContents('Shortcut Logs'),
  ]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function presentDebugContentViewer(
  title: string,
  description: string,
  content: string,
  actions: DebugViewerAction[] = [],
) {
  const webView = new WebView()
  const supportsShareApiResponse = actions.includes('share-api-response')
  const actionBar = actions.length
    ? `
        <div class="actions">
          ${supportsShareApiResponse ? '<a class="btn primary" href="bluelocke://share-api-response">Share</a>' : ''}
          <a class="btn" href="bluelocke://close">Close</a>
        </div>
      `
    : ''

  if (actions.length > 0) {
    webView.shouldAllowRequest = (request) => {
      if (!request.url.startsWith('bluelocke://')) return true

      if (request.url === 'bluelocke://share-api-response') {
        ShareSheet.present(['Bluelink API responses:', getDebugLogContents('Bluelink API Responses')])
      }

      return false
    }
  }

  await webView.loadHTML(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          :root {
            color-scheme: light dark;
          }
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f4f7fb;
            color: #0f172a;
          }
          .card {
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(37, 99, 235, 0.14);
            border-radius: 18px;
            padding: 18px;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
          }
          .actions {
            display: flex;
            gap: 10px;
            margin: 0 0 16px 0;
          }
          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 40px;
            padding: 0 14px;
            border-radius: 12px;
            border: 1px solid rgba(15, 23, 42, 0.16);
            color: #0f172a;
            background: rgba(255, 255, 255, 0.92);
            text-decoration: none;
            font-weight: 600;
          }
          .btn.primary {
            border-color: #2563eb;
            background: #2563eb;
            color: #ffffff;
          }
          h1 {
            margin: 0 0 10px 0;
            font-size: 24px;
          }
          p {
            margin: 0 0 16px 0;
            color: #475569;
            font-size: 14px;
          }
          pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12px;
            line-height: 1.5;
          }
          @media (prefers-color-scheme: dark) {
            body {
              background: #020617;
              color: #e2e8f0;
            }
            .card {
              background: rgba(15, 23, 42, 0.94);
              border-color: rgba(96, 165, 250, 0.24);
              box-shadow: none;
            }
            .btn {
              border-color: rgba(148, 163, 184, 0.32);
              color: #e2e8f0;
              background: rgba(15, 23, 42, 0.8);
            }
            .btn.primary {
              border-color: rgba(96, 165, 250, 0.9);
              background: #2563eb;
              color: #ffffff;
            }
            p {
              color: #94a3b8;
            }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
          ${actionBar}
          <pre>${escapeHtml(content)}</pre>
        </div>
      </body>
    </html>
  `)
  await webView.present()
}

async function presentDebugLogViewer(section: DebugLogSection) {
  await presentDebugContentViewer(
    section,
    'Redacted log view. Reproduce the issue first, then refresh this screen.',
    getDebugLogContents(section),
  )
}

export function doDowngrade(appFile = `${Script.name()}.js`) {
  const fm = FileManager.iCloud()
  if (fm.fileExists(`${SCRIPTABLE_DIR}/${appFile}.backup`)) {
    fm.remove(`${SCRIPTABLE_DIR}/${appFile}`)
    fm.move(`${SCRIPTABLE_DIR}/${appFile}.backup`, `${SCRIPTABLE_DIR}/${appFile}`)
  } else {
    OK('Downgrade Dailed', { message: `There is no previous version of ${appFile}` })
  }
}

async function doUpgrade(url: string, appFile = `${Script.name()}.js`) {
  const req = new Request(url)
  const data = await req.load()
  if (req.response.statusCode === 200) {
    const fm = FileManager.iCloud()
    // try to backup current script - log errors, script could have been renamed for example
    try {
      if (fm.fileExists(`${SCRIPTABLE_DIR}/${appFile}.backup`)) {
        fm.remove(`${SCRIPTABLE_DIR}/${appFile}.backup`)
      }
      fm.move(`${SCRIPTABLE_DIR}/${appFile}`, `${SCRIPTABLE_DIR}/${appFile}.backup`)
    } catch (e) {
      logger.log(`Failed to backup current script: ${e}`)
    }
    fm.write(`${SCRIPTABLE_DIR}/${appFile}`, data)
  } else {
    OK('Download Error', { message: `Failed to download release: ${req.response.statusCode}` })
  }
}

const { present, connect, setState } = getTable<{
  release: GithubRelease | undefined
  currentVersion: string
}>({
  name: 'About App',
})

export async function loadAboutScreen(bl?: Bluelink) {
  // load version async
  const version = new Version('devindxdev', 'bluelocke')
  version.getRelease().then((release) => setState({ release: release }))

  return present({
    defaultState: {
      release: undefined,
      currentVersion: version.getCurrentVersion(),
    },
    render: () => [
      pageTitle(),
      appDescription(),
      appWebsite(),
      author(),
      viewDebugLogs(),
      viewApiResponseData(bl),
      shareDebugLogs(),
      Spacer({ rowHeight: 30 }),
      currentVersion(),
      latestVersion(),
      Spacer(),
      upgrade(),
      upgradeNotes(),
    ],
  })
}

const pageTitle = connect(() => {
  return Div([
    P('Bluelocke', {
      font: (n) => Font.boldSystemFont(n),
      fontSize: 35,
      align: 'left',
    }),
  ])
})

const appDescription = connect(() => {
  return Div(
    [
      P('A Scriptable app for iOS that lets you monitor and control your Hyundai / Kia / Genesis vehicle.', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        align: 'left',
      }),
    ],
    {
      height: 100,
    },
  )
})

const author = connect(() => {
  return Div(
    [
      P('Maintainer: devindxdev', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        align: 'left',
      }),
    ],
    { height: 60, align: 'center' },
  )
})

const viewDebugLogs = connect(() => {
  return Div(
    [
      P('View Debug Logs', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'left',
      }),
      P('Read shortcut, app, widget, API, or API response logs directly in-app.', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 16,
        color: Color.gray(),
        align: 'left',
      }),
    ],
    {
      height: 80,
      onTap: async () => {
        quickOptions([...DEBUG_LOG_SECTIONS, 'Cancel'], {
          title: 'Choose Log to View',
          onOptionSelect: async (opt) => {
            if (opt === 'Cancel') return
            await presentDebugLogViewer(opt as DebugLogSection)
          },
        })
      },
    },
  )
})

const viewApiResponseData = (bl?: Bluelink) =>
  Div(
    [
      P('View API Response Data', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'left',
      }),
      P(
        bl
          ? 'Fetches fresh vehicle data from Bluelink, then opens a redacted in-app viewer. Use Share inside the viewer if needed.'
          : 'Open About from the main app to fetch fresh API response data. Cached response snapshots can still be viewed here.',
        {
          font: (n) => Font.mediumRoundedSystemFont(n),
          fontSize: 16,
          color: Color.gray(),
          align: 'left',
        },
      ),
    ],
    {
      height: 90,
      onTap: async () => {
        if (bl) {
          getBluelinkResponseLogger().clear()
          try {
            await bl.refreshAuth()
            queueNextApiResponseCapture()
            await bl.getStatus(false, true)
          } catch (error) {
            getBluelinkResponseLogger().log(`Failed to fetch API response data: ${error}`)
          }
        }
        await presentDebugContentViewer(
          'Bluelink API Responses',
          'Redacted response view. Fetch fresh data from the main app before sharing if you need a current snapshot.',
          getDebugLogContents('Bluelink API Responses'),
          ['share-api-response', 'close'],
        )
      },
    },
  )

const shareDebugLogs = connect(() => {
  return Div(
    [
      P('Share Debug Logs', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'left',
      }),
      P('Includes app, widget, shortcut, API, and API response logs.', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 16,
        color: Color.gray(),
        align: 'left',
      }),
    ],
    {
      height: 80,
      onTap: async () => {
        await ShareSheet.present(getAllDebugLogs())
      },
    },
  )
})

const currentVersion = connect(({ state: { currentVersion } }) => {
  return Div([
    P(`Current Version:`, {
      font: (n) => Font.mediumRoundedSystemFont(n),
      fontSize: 20,
      align: 'left',
    }),
    P(currentVersion, {
      font: (n) => Font.boldRoundedSystemFont(n),
      fontSize: 20,
      align: 'right',
    }),
  ])
})

const latestVersion = connect(({ state: { currentVersion, release } }) => {
  if (!release) return Spacer()

  return Div([
    P(`Latest Version Available:`, {
      font: (n) => Font.mediumRoundedSystemFont(n),
      fontSize: 20,
      align: 'left',
      width: '80%',
    }),
    P(release.version, {
      font: (n) => Font.boldRoundedSystemFont(n),
      fontSize: 20,
      align: 'right',
      color:
        Version.versionToNumber(currentVersion) >= Version.versionToNumber(release.version)
          ? Color.green()
          : Color.blue(),
    }),
  ])
})

const upgrade = connect(({ state: { currentVersion, release } }) => {
  if (!release || Version.versionToNumber(currentVersion) >= Version.versionToNumber(release.version)) return Spacer()

  return Div(
    [
      P(`Click to Auto Install ${release.version}`, {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'center',
      }),
    ],
    {
      onTap: async () => {
        const appFile = `${Script.name()}.js`
        quickOptions(['Install', 'Cancel'], {
          title: `Confirm Install - App will update "${appFile}" and auto-close`,
          onOptionSelect: async (opt) => {
            if (opt === 'Install') {
              await doUpgrade(release.url, appFile)
              Script.complete()
              // @ts-ignore - undocumented api
              App.close()
            }
          },
        })
      },
    },
  )
})

const upgradeNotes = connect(({ state: { currentVersion, release } }) => {
  if (!release || Version.versionToNumber(currentVersion) >= Version.versionToNumber(release.version)) return Spacer()

  return Div(
    [
      P(`Release Details:\n\n ${release.name}:\n\n ${release.notes}`, {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 17,
        align: 'left',
      }),
    ],
    { height: 300 },
  )
})

const appWebsite = connect(() => {
  const projectUrl = 'https://devindxdev.github.io/bluelocke/'
  return Div(
    [
      P(projectUrl, {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'left',
      }),
    ],
    {
      onTap: async () => {
        Safari.open(projectUrl)
      },
    },
  )
})
