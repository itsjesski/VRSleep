# Git Hooks

This folder contains git hooks that help maintain code quality and conventions.

## Available Hooks

### commit-msg

Validates commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) format.

This is **required** for our automated changelog generation system.

## Installation

### Automatic (Recommended)

Run after cloning the repo:

```bash
npm run prepare-hooks
```

### Manual

Copy hooks to `.git/hooks/`:

```bash
# Windows PowerShell
Copy-Item .githooks\commit-msg .git\hooks\commit-msg

# Git Bash / WSL
cp .githooks/commit-msg .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg
```

## What It Does

When you run `git commit`, the hook validates your message format:

✅ **Passes:**
```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in auth"
git commit -m "docs: update README"
```

❌ **Fails:**
```bash
git commit -m "added feature"        # Missing type prefix
git commit -m "feat:add feature"     # Missing space after colon
git commit -m "feature: add thing"   # Invalid type
```

## Benefits

1. **Consistent commit history** - Easier to review and understand
2. **Automated changelogs** - Your commits become release notes
3. **Better collaboration** - Everyone follows the same format
4. **Semantic versioning** - Types help determine version bumps

## Bypassing (Not Recommended)

If you absolutely must bypass the hook:

```bash
git commit -m "message" --no-verify
```

But please don't! The validation exists to help generate accurate release notes for users.

## See Also

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Full commit message guidelines
- [scripts/EXAMPLES.md](../scripts/EXAMPLES.md) - More commit examples
- [Conventional Commits](https://www.conventionalcommits.org/) - Official spec
