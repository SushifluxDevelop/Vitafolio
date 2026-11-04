# Cv.Desktop - the Windows program

A real Windows program: its own window (WinForms + WebView2), its own icon, a Velopack installer. It runs the server (`Cv.Server`) inside
the same process, only on `127.0.0.1`, and shows the same web UI as the Docker version. The exe is named after the product
(`branding.json`, read by `Directory.Build.props`); nothing in the code spells the name.

## How it starts

1. Velopack hook (`VelopackApp.Build().Run()`), then a single-instance check (a second start brings the running window to the front).
2. `ServerApp.Build` in desktop mode: a random 256-bit token per run, a free local port, data in `%LOCALAPPDATA%\<Company>\<Product>`
   (both from `branding.json`; `DATA_DIR` overrides it). The installer (Velopack, package id = product) owns `%LOCALAPPDATA%\<Product>`
   and deletes it on uninstall and reinstall, so the data never lives there. Data of earlier builds found in that old place (database,
   keys, backups, WebView profile, logs, window.json) is moved once to the new folder at start - only when the new folder does not exist
   yet; the installer's own files stay - and the move is logged.
3. The window shows a branded loading view until `/api/health` answers, sets the cookie `cv_desktop` (HttpOnly, SameSite=Strict) in the
   WebView2 cookie manager, then loads the app. It only navigates inside its own origin; other web links open in the default browser.
4. Closing the window stops the server gracefully (the before-shutdown backup runs) before the process ends. When Windows shuts down or
   the task manager ends the program, the window waits at most 5 seconds for that. If the server stops on its own (an unexpected error),
   the window shows its own error dialog and closes.

Uninstalling (Windows "Apps") removes the program, not the data: `%LOCALAPPDATA%\<Company>\<Product>` stays and is used again by a
later installation. Delete that folder by hand to remove all data.

## Development

| Command | What it does |
|---|---|
| `dotnet run --project src/Cv.Desktop -- --dev` | Server on fixed port 5243, window shows the Vite dev server on 5244 (start it with `VITE_DEV_PORT=5244` and `API_PROXY_TARGET=http://127.0.0.1:5243`), dev tools on, data in `.data/desktop` |
| `Vitafolio.exe --smoke` | No window: starts the server on a free port with temporary data, checks `/api/health`, `/api/version` and the cookie rule, prints the result, exit code 0/1 (for CI; use `Start-Process -Wait -PassThru` to read the exit code of this windowed exe) |
| `.\scripts\build-icon.ps1` | Rebuilds `Assets/app.ico` from `branding/logo.svg` (Playwright container; the .ico is committed) |
| `.\scripts\build-windows.ps1` | `dotnet publish` (win-x64, self-contained) and `vpk pack` into `artifacts/windows` |

`frontend/dist` is copied into the program's `wwwroot` at build/publish time. If it does not exist, the build prints warning `CVDESK001`
(publish fails with `CVDESK002`); `--dev` does not need it.

### Test runs on a chosen monitor

Set the environment variable `CV_DEV_MONITOR` before starting the program. The window and every dialog then open centred on that monitor
and never take the focus or come to the front (so a test run does not disturb what is in use on the main screen); the window position is
neither restored nor saved. The value is matched, case-insensitively as a substring, against the monitor's hardware id
(`MONITOR\<vendor+product code>\...`, stable when Windows renumbers displays) and then against its device name (`\\.\DISPLAY1`). If nothing
matches, the first non-primary screen is used. Not set: normal behaviour.

## Layout

- `Hosting/` - options, paths, log, version, the in-process server, readiness check, single instance, native calls
- `Ui/` - main window, loading view, error dialog (own branded window, selectable text, "Kopieren" button), navigation rules, window placement, theme
- `Texts.cs` - every text the program itself shows, German and English (Windows display language decides)
- `Smoke.cs` - the `--smoke` self test
