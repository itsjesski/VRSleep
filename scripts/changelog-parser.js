/**
 * Changelog Parser
 * Parses CHANGELOG.md into structured data for in-app display
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse the CHANGELOG.md file into structured release data
 * @returns {Array} Array of release objects
 */
function parseChangelog() {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  const content = fs.readFileSync(changelogPath, 'utf8');
  
  const releases = [];
  const lines = content.split('\n');
  
  let currentRelease = null;
  let currentCategory = null;
  
  for (const line of lines) {
    // Match release header: ## [version] - date
    const releaseMatch = line.match(/^## \[([^\]]+)\] - (.+)$/);
    if (releaseMatch) {
      if (currentRelease) {
        releases.push(currentRelease);
      }
      currentRelease = {
        version: releaseMatch[1],
        date: releaseMatch[2],
        changes: {}
      };
      currentCategory = null;
      continue;
    }
    
    // Match category header: ### Category
    const categoryMatch = line.match(/^### (.+)$/);
    if (categoryMatch && currentRelease) {
      currentCategory = categoryMatch[1];
      currentRelease.changes[currentCategory] = [];
      continue;
    }
    
    // Match item: - Item text
    const itemMatch = line.match(/^- (.+)$/);
    if (itemMatch && currentRelease && currentCategory) {
      currentRelease.changes[currentCategory].push(itemMatch[1]);
      continue;
    }
    
    // Stop parsing at separator or full history link
    if (line.startsWith('---') || line.startsWith('[Full commit history]')) {
      if (currentRelease) {
        releases.push(currentRelease);
        currentRelease = null;
      }
      break;
    }
  }
  
  if (currentRelease) {
    releases.push(currentRelease);
  }
  
  return releases;
}

/**
 * Get the latest release notes
 * @returns {Object|null} Latest release object or null
 */
function getLatestRelease() {
  const releases = parseChangelog();
  return releases.length > 0 ? releases[0] : null;
}

/**
 * Get specific release by version
 * @param {string} version - Version to retrieve
 * @returns {Object|null} Release object or null
 */
function getReleaseByVersion(version) {
  const releases = parseChangelog();
  return releases.find(r => r.version === version) || null;
}

/**
 * Format release notes as plain text
 * @param {Object} release - Release object
 * @returns {string} Formatted release notes
 */
function formatReleaseText(release) {
  let text = `Version ${release.version} (${release.date})\n\n`;
  
  const categoryOrder = ['Added', 'Changed', 'Fixed', 'Security'];
  for (const category of categoryOrder) {
    if (release.changes[category] && release.changes[category].length > 0) {
      text += `${category}:\n`;
      for (const item of release.changes[category]) {
        text += `  • ${item}\n`;
      }
      text += '\n';
    }
  }
  
  return text;
}

module.exports = {
  parseChangelog,
  getLatestRelease,
  getReleaseByVersion,
  formatReleaseText
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--json')) {
    console.log(JSON.stringify(parseChangelog(), null, 2));
  } else if (args.includes('--latest')) {
    const latest = getLatestRelease();
    if (latest) {
      console.log(formatReleaseText(latest));
    } else {
      console.log('No releases found.');
    }
  } else {
    const releases = parseChangelog();
    for (const release of releases) {
      console.log(formatReleaseText(release));
      console.log('---\n');
    }
  }
}
