# Building & Installing Polsa

## Prerequisites

- **Node.js** ≥ 20
- **Xcode Command Line Tools** (macOS): `xcode-select --install`

## Development (F5 in VS Code)

Press **F5** to launch in debug mode. This will:

1. Rebuild `better-sqlite3` for Electron
2. Compile TypeScript (main process)
3. Start the Vite dev server (renderer)
4. Launch Electron with debugger attached

The debug configuration uses a **separate database** (`polsa-dev.db`) so your production data is never touched.

- Breakpoints work in both main and renderer processes
- Hot-reload is active for the renderer (React/Vite)
- The dev database lives at `~/Library/Application Support/Polsa/polsa-dev.db`

## Production Build

### From VS Code

1. Open the Command Palette (`Cmd+Shift+P`)
2. Run **Tasks: Run Task**
3. Select **Package for macOS**

### From terminal

```bash
npx electron-rebuild -f -w better-sqlite3
npm run build
npx electron-builder --mac
```

The `.dmg` installer is written to the `release/` directory.

## Installing on macOS

1. Open `release/Polsa-0.1.0-arm64.dmg` (filename may vary by version/arch)
2. Drag **Polsa** to **Applications**
3. On first launch, macOS may block it:
   - Go to **System Settings → Privacy & Security**
   - Scroll to the "Polsa was blocked" message and click **Open Anyway**
   - Or: right-click the app in Finder → **Open** → **Open**

The production database is stored at `~/Library/Application Support/Polsa/polsa.db`.

## Updating

Repeat the build and drag the new `.app` into Applications, replacing the old one. Your database is preserved — it lives outside the app bundle.

## Uninstalling

1. Delete `Polsa.app` from Applications
2. Optionally delete your data: `rm -rf ~/Library/Application\ Support/Polsa/`
