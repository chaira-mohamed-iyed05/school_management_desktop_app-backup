import { app, BrowserWindow, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import log from 'electron-log'

// Resolve preload path relative to the compiled main process output.
function resolvePreloadPath(): string {
  const preloadPath = fileURLToPath(new URL('../preload/preload.js', import.meta.url))
  if (fs.existsSync(preloadPath)) {
    return preloadPath
  }

  const appPath = app.getAppPath()
  const fallbackPath = path.join(appPath, 'out/preload/preload.js')
  if (fs.existsSync(fallbackPath)) {
    return fallbackPath
  }

  throw new Error(`Preload was not found. Expected: ${preloadPath} or ${fallbackPath}`)
}

function resolveIconPath(): string {
  const appPath = app.getAppPath()
  const asarPath = path.join(process.resourcesPath || '', 'app.asar')

  const possibleIcons = [
    path.join(appPath, 'src/renderer/assets/icon.png'),
    path.join(appPath, 'out/renderer/assets/icon-BiP84iCD.png'),
    path.join(appPath, 'build/icons/icon.png'),
    path.join(asarPath, 'out/renderer/assets/icon.png'),
  ]

  for (const p of possibleIcons) {
    if (p && fs.existsSync(p)) {
      return p
    }
  }

  return path.join(appPath, 'src/renderer/assets/icon.png')
}

export function createMainWindow(): BrowserWindow {
  const preloadPath = resolvePreloadPath()
  log.info('Preload path:', preloadPath)

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Edupilot DZ',
    icon: resolveIconPath(),
    show: false, // show after ready-to-show to avoid visual flash
    backgroundColor: '#F8FAFC',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,      // renderer cannot access Node.js
      nodeIntegration: false,       // never enable
      sandbox: true,                // OS-level sandboxing
      webSecurity: true,            // enforce same-origin
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
      // No remote module — deprecated and insecure
    },
  })

  // Show window gracefully after paint
  win.once('ready-to-show', () => {
    win.show()
    if (process.env.NODE_ENV === 'development' && process.env.OPEN_DEVTOOLS === 'true') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Apply strict Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          process.env.NODE_ENV === 'development'
            ? [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'", // needed for dev HMR
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob: http://localhost:*",
                "font-src 'self' data:",
                "connect-src 'self' ws://localhost:* http://localhost:*",
                "media-src 'self' blob:",
                "object-src 'none'",
                "frame-src 'none'",
              ].join('; ')
            : [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob:",
                "font-src 'self' data:",
                "connect-src 'self'",
                "media-src 'self' blob:",
                "object-src 'none'",
                "frame-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
              ].join('; '),
        ],
      },
    })
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}
