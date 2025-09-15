/**
 * Script to simulate regular Git contributions for demonstration purposes
 * This script is for educational purposes to show how regular contributions would look
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Configuration
const CONTRIBUTIONS_PER_DAY = 5;
const START_DATE = new Date('2025-09-01');
const END_DATE = new Date('2025-10-31');
const COMMIT_MESSAGES = [
  'feat(auth): implement basic login functionality',
  'style(ui): enhance login screen design',
  'docs(readme): add project overview',
  'test(auth): add unit tests for login validation',
  'chore(config): configure environment variables',
  'feat(auth): add signup functionality',
  'fix(auth): resolve validation error messages',
  'style(ui): improve form input styling',
  'refactor(components): extract form validation logic',
  'docs(api): document authentication endpoints',
  'feat(profile): create user profile page',
  'style(ui): implement responsive profile layout',
  'test(profile): add tests for profile update',
  'chore(deps): update react and related packages',
  'perf(auth): optimize authentication flow',
  'feat(dashboard): implement home screen',
  'fix(ui): resolve responsive design issues',
  'style(components): enhance card components',
  'docs(contributing): add contribution guidelines',
  'refactor(utils): optimize utility functions',
  'feat(transactions): add transaction history view',
  'style(ui): improve transaction list presentation',
  'test(data): add tests for transaction fetching',
  'chore(build): configure production build settings',
  'perf(data): implement pagination for transactions'
];

// Helper function to get a random commit message
function getRandomCommitMessage() {
  const index = Math.floor(Math.random() * COMMIT_MESSAGES.length);
  return COMMIT_MESSAGES[index];
}

// Helper function to create a dummy change
function createDummyChange(date) {
  const dummyFilePath = path.join(__dirname, '..', 'dummy_changes.txt');
  
  // Read existing content or create new
  let content = '';
  if (fs.existsSync(dummyFilePath)) {
    content = fs.readFileSync(dummyFilePath, 'utf8');
  }
  
  // Append new content with timestamp
  content += `\n// Change made on ${date.toISOString()}\nconsole.log("Dummy change for ${date.toDateString()}");\n`;
  
  fs.writeFileSync(dummyFilePath, content);
}

// Helper function to make a commit
function makeCommit(date, message) {
  try {
    // Set Git author date to simulate past commits
    const dateString = date.toISOString();
    
    execSync(`git add .`, { cwd: path.join(__dirname, '..') });
    execSync(`GIT_AUTHOR_DATE="${dateString}" GIT_COMMITTER_DATE="${dateString}" git commit -m "${message}"`, {
      cwd: path.join(__dirname, '..')
    });
    
    console.log(`Committed: ${message} on ${date.toDateString()}`);
  } catch (error) {
    console.log(`No changes to commit for: ${message}`);
  }
}

// Main function to simulate contributions
function simulateContributions() {
  console.log('Starting contribution simulation...');
  
  let currentDate = new Date(START_DATE);
  let commitCount = 0;
  
  while (currentDate <= END_DATE) {
    // Skip weekends for realistic simulation
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      console.log(`\nSimulating contributions for ${currentDate.toDateString()}:`);
      
      // Make multiple commits per day
      for (let i = 0; i < CONTRIBUTIONS_PER_DAY; i++) {
        // Create a dummy change
        createDummyChange(currentDate);
        
        // Get a commit message
        const message = getRandomCommitMessage();
        
        // Make the commit with the date
        makeCommit(currentDate, message);
        
        commitCount++;
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`\nSimulation complete! Made ${commitCount} commits between ${START_DATE.toDateString()} and ${END_DATE.toDateString()}`);
}

// Run the simulation
// NOTE: This is commented out by default to prevent accidental execution
// Uncomment the line below to run the simulation
// simulateContributions();

console.log('Contribution simulation script ready. Uncomment simulateContributions() to run.');