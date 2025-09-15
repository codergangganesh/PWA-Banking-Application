/**
 * Script to display contribution statistics
 * Shows commit history and contributor information
 */

const { execSync } = require('child_process');
const path = require('path');

// Function to get commit statistics
function getCommitStats() {
  try {
    // Get total commit count
    const totalCommits = execSync('git rev-list --count HEAD', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    }).trim();

    // Get commit count by author
    const commitsByAuthor = execSync('git shortlog -sn --all', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    }).trim();

    // Get recent commits (last 10)
    const recentCommits = execSync('git log --oneline -10', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    }).trim();

    // Get commit count by date for the last week
    const weeklyStats = execSync('git log --since="7 days ago" --oneline --author="$(git config user.email)"', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    }).trim();

    console.log('=== Git Contribution Statistics ===\n');
    console.log(`Total Commits: ${totalCommits}\n`);
    console.log('Commits by Author:');
    console.log(commitsByAuthor || 'No commits found');
    console.log('\nRecent Commits (Last 10):');
    console.log(recentCommits || 'No recent commits');
    console.log('\nYour Commits (Last 7 Days):');
    console.log(weeklyStats ? `${weeklyStats.split('\n').length} commits` : '0 commits');
    
    // Calculate daily average (approximate)
    const totalCommitsNum = parseInt(totalCommits);
    if (totalCommitsNum > 0) {
      // Rough estimate assuming 6 months of development
      const estimatedDays = 180;
      const dailyAverage = (totalCommitsNum / estimatedDays).toFixed(1);
      console.log(`\nEstimated Daily Average: ${dailyAverage} commits/day`);
    }

  } catch (error) {
    console.error('Error fetching git statistics:', error.message);
  }
}

// Function to display branch information
function getBranchInfo() {
  try {
    const branches = execSync('git branch', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    }).trim();

    const currentBranch = execSync('git branch --show-current', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    }).trim();

    console.log('\n=== Branch Information ===');
    console.log(`Current Branch: ${currentBranch}`);
    console.log('All Branches:');
    console.log(branches);
  } catch (error) {
    console.error('Error fetching branch information:', error.message);
  }
}

// Function to show upcoming contribution goals
function showContributionGoals() {
  console.log('\n=== Contribution Goals ===');
  console.log('Daily Target: 5 meaningful commits');
  console.log('Weekly Target: 25 meaningful commits (5 business days)');
  console.log('Monthly Target: ~110 meaningful commits (22 business days)');
  
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  // First day of current month
  const firstDay = new Date(year, month, 1);
  // Today
  const todayDate = new Date();
  
  // Calculate business days in current month so far
  let businessDays = 0;
  for (let d = new Date(firstDay); d <= todayDate; d.setDate(d.getDate() + 1)) {
    // Monday to Friday (1-5)
    if (d.getDay() > 0 && d.getDay() < 6) {
      businessDays++;
    }
  }
  
  const monthlyGoalProgress = businessDays * 5;
  console.log(`\nMonthly Goal Progress: ${monthlyGoalProgress} commits (based on current date)`);
}

// Main function
function main() {
  getCommitStats();
  getBranchInfo();
  showContributionGoals();
  
  console.log('\n=== Tips for Consistent Contributions ===');
  console.log('1. Make small, focused commits throughout the day');
  console.log('2. Use descriptive commit messages');
  console.log('3. Create feature branches for new work');
  console.log('4. Push changes regularly to backup your work');
  console.log('5. Document significant changes in CONTRIBUTION_LOG.md');
}

// Run the script
main();