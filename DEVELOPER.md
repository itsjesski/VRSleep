# VRSleep – Developer Documentation

Technical documentation for contributing to or forking VRSleep.

## Project Overview

VRSleep is an Electron-based desktop application that automates VRChat tasks including:
- Polling VRChat invite notifications at configurable intervals
- Automatically responding to friend invitations based on a whitelist
- Managing user status changes and restoration
- Handling VRChat invite message slots (up to 12)
- Tracking VRChat slot cooldowns accurately
- Rate-limiting API calls to avoid VRChat 429 errors

## Tech Stack

- **Framework**: Electron (desktop app)
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js
- **Package Manager**: npm
- **Build Tool**: electron-builder
- **Auto-updates**: electron-updater
- **Security**: Electron safe storage for credential encryption

## Development Setup

### Prerequisites

- Node.js (v14 or higher)
- npm
- Windows (currently Windows-only)

### Installation

1. Clone the repository
2. Install dependencies:

```powershell
npm install
```

3. Start the development app:

```powershell
npm start
```

## Project Structure

```
src/
├── api/
│   ├── vrcapi.js       # VRChat API client
│   └── vrcauth.js      # VRChat authentication
├── main/
│   ├── index.js        # Electron app entry point
│   ├── ipc.js          # Main process IPC handlers
│   ├── low-ram.js      # Low-memory optimizations
│   ├── sleep-mode.js   # Sleep status management
│   ├── updater.js      # Auto-update logic
│   └── window.js       # Electron window management
├── preload/
│   └── preload.js      # Secure context bridge
├── renderer/
│   ├── index.html      # UI markup
│   └── renderer.js     # UI logic
└── stores/
    ├── auth-store.js   # Authentication state
    ├── message-slots-store.js  # Invite message management
    ├── settings-store.js       # User settings
    └── whitelist-store.js      # Friend whitelist
```

## Building

### Build an installer

Generate a Windows installer (NSIS):

```powershell
npm run dist
```

Output goes to `dist/` directory.

This uses `electron-builder` configured in `package.json`.

## Auto-Updates

VRSleep uses `electron-updater` to check GitHub Releases on startup. If an update is found, users are prompted to download and install it.

### Configuration

Update the GitHub repository info in `package.json`:

```json
{
  "build": {
    "publish": [
      {
        "owner": "your-github-username",
        "repo": "VRSleep"
      }
    ]
  }
}
```

Then publish releases via GitHub, and the app will offer updates automatically.

### Automatic Release Workflow

This repo includes a GitHub Actions workflow that automatically builds and publishes releases when you push a git tag starting with `v`:

```powershell
git tag v0.6.0
git push origin v0.6.0
```

The workflow will build the Windows installer and attach it to the GitHub Release.

## Security

- **Credential Storage**: Login cookies are encrypted using Electron's safe storage
- **Context Bridge**: Secure bridge isolates renderer (UI) from Node.js internals
- **Logout Function**: Wipes stored credentials from encrypted storage
- **API Communication**: Only communicates with VRChat's official API servers

## Architecture Notes

### Rate Limiting

VRSleep uses sequential batching and on-demand fetching to respect VRChat API rate limits (429 errors).

### Performance Optimization

- Minimal renderer footprint and low-RAM defaults
- UI dashboard loads near-instantly on startup
- Efficient polling intervals to minimize CPU usage

### Cooldown Tracking

VRChat enforces a 60-minute cooldown on slot updates. The app tracks this accurately, even after app restarts.

## VRChat API Integration

### VRC API Client (`src/api/vrcapi.js`)

Handles all VRChat API interactions including:
- Fetching friend notifications
- Sending invitations
- Pulling user and status data
- Managing message slots

### VRC Auth (`src/api/vrcauth.js`)

Manages authentication flow:
- 2FA support
- Session token management
- Credential validation

## Data Storage

Configuration and authentication data is stored using `electron-store` with encryption for sensitive information.

### Store Files

- `auth-store.js`: Authentication credentials
- `settings-store.js`: User preferences and app settings
- `whitelist-store.js`: Friend whitelist entries
- `message-slots-store.js`: Custom invitation messages and cooldown tracking

## IPC Communication

The main process and renderer communicate via IPC (Inter-Process Communication):

- Main process handles API calls and secure operations
- Renderer displays UI and captures user input
- Preload script provides secure bridge between them

## Contributing

When making changes:
1. Ensure code follows existing style conventions
2. Test thoroughly with VRChat's API (rate limits apply)
3. Update version in `package.json` for releases
4. Create a git tag for automatic release builds

## Troubleshooting Development

- **App won't start**: Check Node.js version and run `npm install` again
- **API errors**: Verify VRChat credentials and check API status
- **Build fails**: Ensure Windows Build Tools are installed for native modules

## License

See LICENSE file for details.

---

For user documentation, see [README.md](README.md)
