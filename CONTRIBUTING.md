# Contributing to VRSleep

Thank you for contributing! This guide will help you write commits that work with our automated release system.

## 🚨 Important: Commit Message Format

**VRSleep uses automated changelog generation.** Your commit messages become the release notes that users see!

### Required Format

Use **Conventional Commits** format:

```
<type>(<scope>): <description>

[optional body]
```

### Commit Types

| Type | When to Use | Appears In |
|------|-------------|------------|
| `feat` | New features | **Added** section |
| `fix` | Bug fixes | **Fixed** section |
| `security` | Security improvements | **Security** section |
| `refactor` | Code improvements | **Changed** section |
| `perf` | Performance improvements | **Changed** section |
| `docs` | Documentation only | *(not in changelog)* |
| `chore` | Maintenance tasks | *(not in changelog)* |
| `test` | Adding tests | *(not in changelog)* |
| `style` | Formatting, no code change | *(not in changelog)* |

### ✅ Good Examples

```bash
# Feature (shows in "Added")
git commit -m "feat: add automatic log rotation with 5MB limit"
git commit -m "feat(ui): implement user dropdown menu with logout option"

# Bug fix (shows in "Fixed")
git commit -m "fix: resolve memory leak in sleep mode tracking"
git commit -m "fix(auth): handle 2FA timeout gracefully"

# Security (shows in "Security")
git commit -m "security: add input sanitization for all IPC handlers"
git commit -m "security: upgrade electron to patch CVE-2024-1234"

# Improvements (shows in "Changed")
git commit -m "refactor: centralize API configuration"
git commit -m "perf: reduce memory usage by 40%"

# Documentation (not in changelog)
git commit -m "docs: update README with new installation steps"
```

### ❌ Bad Examples

```bash
# Too vague
git commit -m "fix stuff"
git commit -m "update"
git commit -m "changes"

# Missing type
git commit -m "added new feature"  # Should be: feat: add new feature
git commit -m "fixed bug"          # Should be: fix: resolve bug

# Wrong capitalization (description should be lowercase)
git commit -m "feat: Add New Feature"  # Should be: feat: add new feature
```

## Why This Matters

When you run `npm run release`, the script:
1. Analyzes all commits since the last release
2. Categorizes them by type (`feat` → Added, `fix` → Fixed, etc.)
3. Generates formatted changelog automatically
4. Creates GitHub release notes

**Your commit message = User-facing release note!**

Example:
```bash
git commit -m "feat: add file-based error logging"
```

Becomes:
```markdown
### Added
- Add file-based error logging
```

## Setting Up Commit Message Validation

We provide a git hook to validate your commits:

```powershell
# Install the commit message hook
npm run prepare-hooks

# Or manually:
cp .githooks/commit-msg .git/hooks/commit-msg
```

This will check your commit messages and prevent commits that don't follow the format.

## Workflow Example

```bash
# 1. Make changes
# ... edit files ...

# 2. Stage changes
git add .

# 3. Commit with conventional format
git commit -m "feat: add new dashboard widget"

# Hook validates format ✓
# Commit succeeds ✓

# 4. When ready to release
npm run release
# Your commit appears in changelog automatically!
```

## Optional Scope

You can add an optional scope for more context:

```bash
git commit -m "feat(api): add rate limiting"
git commit -m "fix(ui): correct button alignment"
git commit -m "refactor(auth): simplify token handling"
```

The scope helps organize changes but isn't required.

## Breaking Changes

For breaking changes, add `!` after type/scope:

```bash
git commit -m "feat!: change API response format"
git commit -m "refactor(api)!: remove deprecated endpoints"
```

Or add `BREAKING CHANGE:` in the body:

```bash
git commit -m "feat: migrate to new auth system

BREAKING CHANGE: Users must re-authenticate after update"
```

## Tips

1. **Write for users, not developers**: Your commit becomes a user-facing release note
2. **Be specific**: "fix: resolve memory leak in polling" > "fix: memory issue"
3. **One logical change per commit**: Easier to categorize and review
4. **Use present tense**: "add feature" not "added feature"
5. **Start with lowercase**: "feat: add feature" not "feat: Add feature"

## Questions?

- Read [Conventional Commits](https://www.conventionalcommits.org/)
- Check [scripts/EXAMPLES.md](scripts/EXAMPLES.md) for more examples
- See [scripts/README.md](scripts/README.md) for release process

Thank you for following these guidelines! 🎉
