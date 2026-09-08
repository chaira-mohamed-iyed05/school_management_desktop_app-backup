# Edupilot DZ — نظام إدارة المدرسة

> **Offline-first** school management desktop app for Windows — built with Electron, React, SQLite, and TypeScript.

---

## Features

- 🔒 **Fully offline** — all data stored locally, no internet required
- 📦 **SQLite database** with WAL mode, Drizzle ORM, and automatic migrations
- 🔐 **Argon2id** password hashing with brute-force lockout
- 📱 **QR code** student attendance scanning (USB barcode reader compatible)
- 🌐 **Trilingual** — Arabic (RTL primary), French, English with instant switching
- 🖨️ **Print** student ID cards (CR-80) and payment receipts
- 💾 **Encrypted backups** with SHA-256 integrity verification

---

## Quick Start (Development)

### Prerequisites

- Node.js 20+ (see `.mise.toml`)
- pnpm 11+
- **Windows only**: Visual Studio 2022 Build Tools with "Desktop development with C++"

### Install Visual Studio Build Tools (Required for native modules)

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Then restart your terminal.

### Setup

```powershell
# Install dependencies (includes better-sqlite3 and @node-rs/argon2 native builds)
pnpm install

# Download local fonts (Inter + Amiri)
pnpm fonts:download

# Generate app icons from online-education.png
# 1. Place online-education.png in /public/
# 2. Run:
pnpm icon:build

# Start the app in development mode
pnpm dev
```

### Build for Production (Windows NSIS installer)

```powershell
pnpm dist:win
# Output: release/EdupilotDZ-Setup-1.0.0.exe
```

---

## Project Structure

```
src/
├── main/                  # Electron main process (Node.js)
│   ├── database/          # SQLite connection, schema, migrations
│   ├── services/          # Business logic (auth, students, attendance...)
│   ├── ipc/               # IPC handlers (one file per domain)
│   └── windows/           # BrowserWindow factory
├── preload/               # Context bridge (renderer ↔ main)
│   ├── preload.ts         # Typed API exposed via contextBridge
│   └── types.d.ts         # window.schoolApp global type
├── renderer/              # React renderer (browser sandbox)
│   ├── App.tsx            # Router + AuthProvider
│   ├── pages/             # Full pages (Login, Setup, Dashboard...)
│   ├── components/        # Shared UI components
│   ├── features/auth/     # AuthContext + useAuth hook
│   ├── i18n/              # i18next config + ar/fr/en locales
│   └── styles/            # Global CSS (local fonts, RTL, print)
└── shared/                # Code shared by main and renderer
    ├── types/             # TypeScript interfaces
    ├── schemas/           # Zod validation schemas
    ├── constants/         # IPC channel names, app constants
    └── errors/            # Error code enum
```

---

## Security Architecture

| Concern | Implementation |
|---------|----------------|
| Renderer isolation | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` |
| API surface | `window.schoolApp` via `contextBridge` — no Node.js in renderer |
| Input validation | Zod schemas on every IPC input |
| Password hashing | Argon2id (t=3, m=65536, p=4) |
| Brute-force protection | 5 attempts → 15-min lockout |
| Content Security Policy | Strict CSP via `webRequest.onHeadersReceived` |
| File access | All file I/O happens in main process; renderer uses IPC dialogs |
| Database | WAL mode, foreign keys ON, 8MB cache |

---

## User Data Locations (Windows)

| Type | Path |
|------|------|
| Database | `%APPDATA%\edupilot-dz\school-management.sqlite` |
| Logs | `%APPDATA%\edupilot-dz\logs\` |
| Media (photos) | `%APPDATA%\edupilot-dz\media\` |
| Backups (default) | `%APPDATA%\edupilot-dz\backups\` |

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Electron in development mode (HMR enabled) |
| `pnpm build` | Build all processes (main, preload, renderer) |
| `pnpm dist:win` | Build + package Windows NSIS installer |
| `pnpm fonts:download` | Download Inter + Amiri woff2 fonts locally |
| `pnpm icon:build` | Generate .ico and .png icons from source |
| `pnpm typecheck` | TypeScript type check without emit |

---

## First Launch

On first launch, a 3-step setup wizard appears:
1. **School information** — name (Arabic + French), phone, academic year
2. **Administrator account** — username + Argon2id-hashed password
3. **Language preference** — Arabic/French/English (can be changed anytime)

After setup completes, the app auto-logs in and shows the dashboard.
