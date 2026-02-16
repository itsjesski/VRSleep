#!/usr/bin/env node

/**
 * Install Git Hooks
 * Copies hooks from .githooks/ to .git/hooks/
 */

const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '..', '.githooks');
const gitHooksDir = path.join(__dirname, '..', '.git', 'hooks');

// Check if .git directory exists (not present in fresh clone before git init)
if (!fs.existsSync(gitHooksDir)) {
  console.log('⚠️  .git/hooks directory not found. Skipping hook installation.');
  console.log('   Run "npm run prepare-hooks" after git is initialized.');
  process.exit(0);
}

// Get all hook files from .githooks
const hookFiles = fs.readdirSync(hooksDir).filter(file => {
  // Skip README and other non-hook files
  return !file.includes('.md') && !file.includes('.');
});

if (hookFiles.length === 0) {
  console.log('No git hooks to install.');
  process.exit(0);
}

console.log('📋 Installing git hooks...\n');

let installed = 0;
for (const hookFile of hookFiles) {
  const source = path.join(hooksDir, hookFile);
  const dest = path.join(gitHooksDir, hookFile);
  
  try {
    // Copy the hook file
    fs.copyFileSync(source, dest);
    
    // Make executable (Unix-like systems)
    try {
      fs.chmodSync(dest, 0o755);
    } catch (err) {
      // Windows doesn't need chmod, ignore error
    }
    
    console.log(`✓ Installed ${hookFile}`);
    installed++;
  } catch (error) {
    console.error(`✗ Failed to install ${hookFile}:`, error.message);
  }
}

console.log(`\n✅ Installed ${installed} git hook${installed !== 1 ? 's' : ''}`);
console.log('\n📝 Commit messages will now be validated automatically.');
console.log('   See CONTRIBUTING.md for commit message guidelines.\n');
