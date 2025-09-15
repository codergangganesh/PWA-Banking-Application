/**
 * Script to create daily contribution logs
 * Helps track progress and maintain consistent contributions
 */

const fs = require('fs');
const path = require('path');

// Function to get formatted date
function getFormattedDate(date = new Date()) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Function to get weekday name
function getWeekday(date = new Date()) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return weekdays[date.getDay()];
}

// Function to create daily log entry
function createDailyLog() {
  const today = new Date();
  const formattedDate = getFormattedDate(today);
  const weekday = getWeekday(today);
  
  // Log entry template
  const logEntry = `
### ${weekday}, ${formattedDate}

#### Goals for Today:
- [ ] Make 5 meaningful contributions
- [ ] Focus on one main feature or improvement
- [ ] Write clear, descriptive commit messages
- [ ] Push changes regularly
- [ ] Update documentation if needed

#### Completed Contributions:
1. [ ] 
2. [ ] 
3. [ ] 
4. [ ] 
5. [ ] 

#### Notes:
- 

---

`;
  
  // Path to daily log file
  const logDir = path.join(__dirname, '..', 'daily_logs');
  const logFile = path.join(logDir, `${formattedDate}.md`);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  
  // Create log file if it doesn't exist
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, `# Daily Contribution Log\n${logEntry}`);
    console.log(`Created daily log file: ${logFile}`);
  } else {
    console.log(`Daily log file already exists: ${logFile}`);
  }
  
  return logFile;
}

// Function to add a contribution to today's log
function addContribution(description) {
  const today = new Date();
  const formattedDate = getFormattedDate(today);
  const logFile = path.join(__dirname, '..', 'daily_logs', `${formattedDate}.md`);
  
  if (!fs.existsSync(logFile)) {
    console.log('No daily log file found for today. Creating one...');
    createDailyLog();
  }
  
  // Read current content
  let content = fs.readFileSync(logFile, 'utf8');
  
  // Find the completed contributions section
  const lines = content.split('\n');
  let contribSectionStart = -1;
  let contribSectionEnd = -1;
  
  // Find start of contribution section
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('#### Completed Contributions:')) {
      contribSectionStart = i;
      break;
    }
  }
  
  // Find end of contribution section (next section or end of file)
  if (contribSectionStart !== -1) {
    for (let i = contribSectionStart + 1; i < lines.length; i++) {
      if (lines[i].startsWith('#### ') && i > contribSectionStart + 1) {
        contribSectionEnd = i;
        break;
      }
    }
    if (contribSectionEnd === -1) {
      contribSectionEnd = lines.length;
    }
  }
  
  if (contribSectionStart !== -1) {
    // Look for first unchecked item
    let updated = false;
    for (let i = contribSectionStart + 1; i < contribSectionEnd; i++) {
      if (lines[i].includes('[ ]')) {
        // Extract the item number and replace the whole line
        const itemNumber = lines[i].split('.')[0];
        lines[i] = `${itemNumber}. [x] ${description}`;
        updated = true;
        break;
      }
    }
    
    if (updated) {
      fs.writeFileSync(logFile, lines.join('\n'));
      console.log(`Added contribution to daily log: ${description}`);
    } else {
      console.log('All contribution slots filled for today!');
    }
  } else {
    console.log('Could not find contribution section in daily log');
  }
}

// Main function
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Create daily log
    createDailyLog();
  } else if (args[0] === 'add' && args.length > 1) {
    // Add contribution
    const description = args.slice(1).join(' ');
    addContribution(description);
  } else {
    console.log('Usage:');
    console.log('  node scripts/daily-log.cjs          - Create daily log for today');
    console.log('  node scripts/daily-log.cjs add "Description of contribution" - Add contribution to today\'s log');
  }
}

// Run the script
main();