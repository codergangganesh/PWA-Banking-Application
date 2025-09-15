/**
 * Script to generate a changelog from Git commit history
 * Groups commits by type (feat, fix, etc.) and formats them for a CHANGELOG.md file
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to get git tags
function getTags() {
  try {
    const tags = execSync('git tag --sort=-creatordate', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    }).trim().split('\n').filter(tag => tag.length > 0);
    
    return tags;
  } catch (error) {
    console.error('Error getting tags:', error.message);
    return [];
  }
}

// Function to get commits between two refs
function getCommits(from, to) {
  try {
    const range = from ? `${from}..${to}` : to;
    const logFormat = '%H|%s|%an|%aI'; // hash|subject|author|author date ISO 8601
    
    const commits = execSync(`git log --no-merges --pretty=format:"${logFormat}" ${range}`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    }).trim();
    
    if (!commits) return [];
    
    return commits.split('\n').map(line => {
      const [hash, subject, author, date] = line.split('|');
      return { hash, subject, author, date };
    });
  } catch (error) {
    console.error(`Error getting commits from ${from} to ${to}:`, error.message);
    return [];
  }
}

// Function to parse conventional commits
function parseCommit(commit) {
  const conventionalCommitRegex = /^(\w+)(?:\(([^)]+)\))?: (.+)$/;
  const match = commit.subject.match(conventionalCommitRegex);
  
  if (match) {
    return {
      type: match[1],
      scope: match[2] || '',
      message: match[3],
      hash: commit.hash.substring(0, 7),
      author: commit.author,
      date: commit.date
    };
  }
  
  // For non-conventional commits, categorize as misc
  return {
    type: 'misc',
    scope: '',
    message: commit.subject,
    hash: commit.hash.substring(0, 7),
    author: commit.author,
    date: commit.date
  };
}

// Function to group commits by type
function groupCommitsByType(commits) {
  const grouped = {};
  
  commits.forEach(commit => {
    const parsed = parseCommit(commit);
    if (!grouped[parsed.type]) {
      grouped[parsed.type] = [];
    }
    grouped[parsed.type].push(parsed);
  });
  
  return grouped;
}

// Function to generate markdown for commits
function generateMarkdown(groupedCommits) {
  const typeDescriptions = {
    feat: 'Features',
    fix: 'Bug Fixes',
    docs: 'Documentation',
    style: 'Styles',
    refactor: 'Code Refactoring',
    test: 'Tests',
    chore: 'Chores',
    misc: 'Miscellaneous'
  };
  
  let markdown = '# Changelog\n\n';
  
  // Add unreleased section
  markdown += '## [Unreleased]\n\n';
  
  for (const [type, commits] of Object.entries(groupedCommits)) {
    if (commits.length === 0) continue;
    
    const description = typeDescriptions[type] || type.charAt(0).toUpperCase() + type.slice(1);
    markdown += `### ${description}\n\n`;
    
    commits.forEach(commit => {
      const scopePart = commit.scope ? `**${commit.scope}:** ` : '';
      markdown += `- ${scopePart}${commit.message} (${commit.hash})\n`;
    });
    
    markdown += '\n';
  }
  
  // Add previous versions (tags) - simplified for this example
  markdown += '## Previous Versions\n\n';
  markdown += 'For previous versions, see Git commit history.\n';
  
  return markdown;
}

// Main function
function main() {
  try {
    console.log('Generating changelog...');
    
    // Get all commits
    const commits = getCommits('', 'HEAD');
    
    if (commits.length === 0) {
      console.log('No commits found');
      return;
    }
    
    // Group commits by type
    const groupedCommits = groupCommitsByType(commits);
    
    // Generate markdown
    const changelog = generateMarkdown(groupedCommits);
    
    // Write to CHANGELOG.md
    const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
    fs.writeFileSync(changelogPath, changelog);
    
    console.log('Changelog generated successfully!');
    console.log(`Output written to: ${changelogPath}`);
  } catch (error) {
    console.error('Error generating changelog:', error.message);
  }
}

// Run the script
main();