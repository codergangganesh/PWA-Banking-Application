# Git Workflow Helper Script for PowerShell
# Simplifies common Git operations for consistent contributions

# Function to print colored output
function Print-Message {
    param(
        [string]$Color,
        [string]$Message
    )
    
    switch ($Color) {
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Blue" { Write-Host $Message -ForegroundColor Blue }
        default { Write-Host $Message }
    }
}

# Function to create a new feature branch
function Create-FeatureBranch {
    param(
        [string]$FeatureName
    )
    
    if ([string]::IsNullOrEmpty($FeatureName)) {
        Print-Message "Red" "Error: Please provide a feature name"
        Print-Message "Yellow" "Usage: .\scripts\git-workflow-helper.ps1 feature <feature-name>"
        return
    }
    
    $BranchName = "feature/$FeatureName"
    
    Print-Message "Blue" "Creating feature branch: $BranchName"
    git checkout -b $BranchName
    
    if ($LASTEXITCODE -eq 0) {
        Print-Message "Green" "Successfully created and switched to $BranchName"
    } else {
        Print-Message "Red" "Failed to create feature branch"
    }
}

# Function to make a commit with conventional commit format
function Make-ConventionalCommit {
    param(
        [string]$CommitType,
        [string[]]$CommitMessage
    )
    
    if ([string]::IsNullOrEmpty($CommitType) -or $CommitMessage.Count -eq 0) {
        Print-Message "Red" "Error: Please provide commit type and message"
        Print-Message "Yellow" "Usage: .\scripts\git-workflow-helper.ps1 commit <type> <message>"
        Print-Message "Yellow" "Types: feat, fix, docs, style, refactor, test, chore"
        return
    }
    
    # Validate commit type
    $ValidTypes = @("feat", "fix", "docs", "style", "refactor", "test", "chore")
    $IsValid = $ValidTypes -contains $CommitType
    
    if (-not $IsValid) {
        Print-Message "Red" "Invalid commit type: $CommitType"
        Print-Message "Yellow" "Valid types: $($ValidTypes -join ', ')"
        return
    }
    
    $Message = $CommitMessage -join " "
    $FullMessage = "{0}: {1}" -f $CommitType, $Message
    
    Print-Message "Blue" "Making commit: $FullMessage"
    git add .
    git commit -m $FullMessage
    
    if ($LASTEXITCODE -eq 0) {
        Print-Message "Green" "Successfully committed changes"
    } else {
        Print-Message "Red" "Failed to commit changes"
    }
}

# Function to publish current branch
function Publish-Branch {
    $CurrentBranch = git branch --show-current 2>$null
    
    if ([string]::IsNullOrEmpty($CurrentBranch)) {
        Print-Message "Red" "Error: Not currently on any branch"
        return
    }
    
    Print-Message "Blue" "Publishing branch: $CurrentBranch"
    git push -u origin $CurrentBranch
    
    if ($LASTEXITCODE -eq 0) {
        Print-Message "Green" "Successfully published $CurrentBranch"
    } else {
        Print-Message "Red" "Failed to publish branch"
    }
}

# Function to show contribution statistics
function Show-Stats {
    Print-Message "Blue" "=== Git Contribution Statistics ==="
    
    # Total commits
    $TotalCommits = git rev-list --count HEAD 2>$null
    if ($LASTEXITCODE -eq 0) {
        Print-Message "Green" "Total Commits: $TotalCommits"
    } else {
        Print-Message "Red" "Unable to get commit count"
    }
    
    # Recent commits
    Print-Message "Blue" "`nRecent Commits:"
    git log --oneline -5 2>$null
    if ($LASTEXITCODE -ne 0) {
        Print-Message "Red" "Unable to get commit history"
    }
    
    # Current branch
    $CurrentBranch = git branch --show-current 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrEmpty($CurrentBranch)) {
        Print-Message "Blue" "`nCurrent Branch: $CurrentBranch"
    } else {
        Print-Message "Red" "`nUnable to determine current branch"
    }
}

# Main script logic
if ($args.Count -eq 0) {
    Print-Message "Yellow" "Git Workflow Helper Script"
    Print-Message "Yellow" "=========================="
    Print-Message "Yellow" ""
    Print-Message "Yellow" "Usage:"
    Print-Message "Yellow" "  .\scripts\git-workflow-helper.ps1 feature <feature-name>     - Create and switch to a new feature branch"
    Print-Message "Yellow" "  .\scripts\git-workflow-helper.ps1 commit <type> <message>   - Make a conventional commit"
    Print-Message "Yellow" "  .\scripts\git-workflow-helper.ps1 publish                   - Publish current branch to origin"
    Print-Message "Yellow" "  .\scripts\git-workflow-helper.ps1 stats                     - Show contribution statistics"
    Print-Message "Yellow" ""
    Print-Message "Yellow" "Commit Types:"
    Print-Message "Yellow" "  feat     - A new feature"
    Print-Message "Yellow" "  fix      - A bug fix"
    Print-Message "Yellow" "  docs     - Documentation only changes"
    Print-Message "Yellow" "  style    - Changes that do not affect the meaning of the code"
    Print-Message "Yellow" "  refactor - A code change that neither fixes a bug nor adds a feature"
    Print-Message "Yellow" "  test     - Adding missing tests or correcting existing tests"
    Print-Message "Yellow" "  chore    - Changes to the build process or auxiliary tools"
    return
}

switch ($args[0]) {
    "feature" {
        if ($args.Count -gt 1) {
            Create-FeatureBranch -FeatureName $args[1]
        } else {
            Print-Message "Red" "Error: Please provide a feature name"
            Print-Message "Yellow" "Usage: .\scripts\git-workflow-helper.ps1 feature <feature-name>"
        }
    }
    "commit" {
        if ($args.Count -gt 2) {
            $MessageType = $args[1]
            $MessageContent = $args[2..($args.Length-1)]
            Make-ConventionalCommit -CommitType $MessageType -CommitMessage $MessageContent
        } else {
            Print-Message "Red" "Error: Please provide commit type and message"
            Print-Message "Yellow" "Usage: .\scripts\git-workflow-helper.ps1 commit <type> <message>"
            Print-Message "Yellow" "Types: feat, fix, docs, style, refactor, test, chore"
        }
    }
    "publish" {
        Publish-Branch
    }
    "stats" {
        Show-Stats
    }
    default {
        Print-Message "Yellow" "Unknown command: $($args[0])"
        Print-Message "Yellow" "Use without arguments to see help"
    }
}