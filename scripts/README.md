# Release Scripts

This folder contains scripts for managing releases and changelogs.

## Usage

### Creating a Release

```bash
npm run release
```

This interactive script will:
1. **Auto-analyze your git commits** since the last release
2. **Categorize changes** based on conventional commit format:
   - `feat:` → Added
   - `fix:` → Fixed
   - `refactor:`, `perf:`, `improve:` → Changed
   - `security:`, `sec:` → Security
3. **Generate structured changelog** automatically
4. Give you the option to review/edit before proceeding
5. Update CHANGELOG.md with the new version
6. Commit the changelog and bump version in package.json
7. Create and push a git tag
8. **Automatically create GitHub release draft** (if GitHub CLI is installed)

After running `npm run release`:
1. Run `npm run dist` to build the installer
2. If GitHub CLI created the draft release:
   - Go to GitHub Releases
   - Upload the installer to the draft
   - Publish the release
3. If manual creation needed:
   - Copy notes from RELEASE_NOTES.md
   - Go to GitHub Releases and create manually

### Commit Message Format

For best results, use **conventional commit format**:

```bash
# Features (appears in "Added")
git commit -m "feat: add new dashboard widget"
git commit -m "feat(ui): implement dark mode"

# Bug fixes (appears in "Fixed")
git commit -m "fix: resolve memory leak in polling"
git commit -m "fix(auth): handle 2FA timeout correctly"

# Improvements (appears in "Changed")
git commit -m "refactor: optimize API request batching"
git commit -m "perf: reduce memory usage by 30%"

# Security (appears in "Security")
git commit -m "security: add input sanitization"
git commit -m "sec: upgrade crypto library"

# Ignored (not in changelog)
git commit -m "docs: update README"
git commit -m "chore: update dependencies"
git commit -m "style: fix formatting"
```

The script is smart enough to handle commits without conventional format too!

### GitHub CLI Setup (Optional but Recommended)

Install [GitHub CLI](https://cli.github.com/) to enable automatic GitHub release creation:

```powershell
# Windows (using winget)
winget install --id GitHub.cli

# Or download from https://cli.github.com/
```

After installing, authenticate:

```bash
gh auth login
```

With GitHub CLI installed, `npm run release` will automatically create draft releases on GitHub with formatted release notes!

### Viewing the Changelog

```bash
# View full changelog
npm run changelog

# View in JSON format (for programmatic use)
node scripts/changelog-parser.js --json

# View only latest release
node scripts/changelog-parser.js --latest
```

## Changelog Format

The CHANGELOG.md follows this structure:

```markdown
## [1.2.0] - 2026-02-16

### Added
- New feature 1
- New feature 2

### Changed
- Modified behavior 1

### Fixed
- Bug fix 1

### Security
- Security improvement 1
```

### Categories

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Fixed**: Bug fixes
- **Security**: Security-related improvements

## For In-App Patch Notes

The `changelog-parser.js` module can be imported into the app to display patch notes:

```javascript
const { getLatestRelease, formatReleaseText } = require('./scripts/changelog-parser');

// Get latest release data
const latest = getLatestRelease();
console.log(latest);
// {
//   version: "1.2.0",
//   date: "2026-02-16",
//   changes: {
//     Added: ["New feature 1", ...],
//     Changed: [...],
//     ...
//   }
// }

// Or get formatted text
const text = formatReleaseText(latest);
```

This makes it easy to show "What's New" dialogs or patch notes within the application.
