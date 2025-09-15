#!/bin/bash

# Git Workflow Helper Script
# Simplifies common Git operations for consistent contributions

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
    color=$1
    message=$2
    echo -e "${color}${message}${NC}"
}

# Function to create a new feature branch
create_feature_branch() {
    if [ $# -eq 0 ]; then
        print_message $RED "Error: Please provide a feature name"
        print_message $YELLOW "Usage: ./scripts/git-workflow-helper.sh feature <feature-name>"
        return 1
    fi
    
    feature_name=$1
    branch_name="feature/${feature_name}"
    
    print_message $BLUE "Creating feature branch: ${branch_name}"
    git checkout -b "$branch_name"
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "Successfully created and switched to ${branch_name}"
    else
        print_message $RED "Failed to create feature branch"
        return 1
    fi
}

# Function to make a commit with conventional commit format
make_conventional_commit() {
    if [ $# -lt 2 ]; then
        print_message $RED "Error: Please provide commit type and message"
        print_message $YELLOW "Usage: ./scripts/git-workflow-helper.sh commit <type> <message>"
        print_message $YELLOW "Types: feat, fix, docs, style, refactor, test, chore"
        return 1
    fi
    
    commit_type=$1
    shift
    commit_message=$@
    
    # Validate commit type
    valid_types=("feat" "fix" "docs" "style" "refactor" "test" "chore")
    is_valid=false
    
    for type in "${valid_types[@]}"; do
        if [ "$commit_type" == "$type" ]; then
            is_valid=true
            break
        fi
    done
    
    if [ "$is_valid" == false ]; then
        print_message $RED "Invalid commit type: ${commit_type}"
        print_message $YELLOW "Valid types: ${valid_types[*]}"
        return 1
    fi
    
    full_message="${commit_type}: ${commit_message}"
    
    print_message $BLUE "Making commit: ${full_message}"
    git add .
    git commit -m "$full_message"
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "Successfully committed changes"
    else
        print_message $RED "Failed to commit changes"
        return 1
    fi
}

# Function to publish current branch
publish_branch() {
    current_branch=$(git branch --show-current)
    
    if [ -z "$current_branch" ]; then
        print_message $RED "Error: Not currently on any branch"
        return 1
    fi
    
    print_message $BLUE "Publishing branch: ${current_branch}"
    git push -u origin "$current_branch"
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "Successfully published ${current_branch}"
    else
        print_message $RED "Failed to publish branch"
        return 1
    fi
}

# Function to show contribution statistics
show_stats() {
    print_message $BLUE "=== Git Contribution Statistics ==="
    
    # Total commits
    total_commits=$(git rev-list --count HEAD 2>/dev/null)
    if [ $? -eq 0 ]; then
        print_message $GREEN "Total Commits: ${total_commits}"
    else
        print_message $RED "Unable to get commit count"
    fi
    
    # Recent commits
    print_message $BLUE "\nRecent Commits:"
    git log --oneline -5 2>/dev/null || print_message $RED "Unable to get commit history"
    
    # Current branch
    current_branch=$(git branch --show-current 2>/dev/null)
    if [ $? -eq 0 ] && [ ! -z "$current_branch" ]; then
        print_message $BLUE "\nCurrent Branch: ${current_branch}"
    else
        print_message $RED "\nUnable to determine current branch"
    fi
}

# Main script logic
case $1 in
    feature)
        shift
        create_feature_branch "$@"
        ;;
    commit)
        shift
        make_conventional_commit "$@"
        ;;
    publish)
        publish_branch
        ;;
    stats)
        show_stats
        ;;
    *)
        print_message $YELLOW "Git Workflow Helper Script"
        print_message $YELLOW "=========================="
        print_message $YELLOW ""
        print_message $YELLOW "Usage:"
        print_message $YELLOW "  ./scripts/git-workflow-helper.sh feature <feature-name>     - Create and switch to a new feature branch"
        print_message $YELLOW "  ./scripts/git-workflow-helper.sh commit <type> <message>   - Make a conventional commit"
        print_message $YELLOW "  ./scripts/git-workflow-helper.sh publish                   - Publish current branch to origin"
        print_message $YELLOW "  ./scripts/git-workflow-helper.sh stats                     - Show contribution statistics"
        print_message $YELLOW ""
        print_message $YELLOW "Commit Types:"
        print_message $YELLOW "  feat     - A new feature"
        print_message $YELLOW "  fix      - A bug fix"
        print_message $YELLOW "  docs     - Documentation only changes"
        print_message $YELLOW "  style    - Changes that do not affect the meaning of the code"
        print_message $YELLOW "  refactor - A code change that neither fixes a bug nor adds a feature"
        print_message $YELLOW "  test     - Adding missing tests or correcting existing tests"
        print_message $YELLOW "  chore    - Changes to the build process or auxiliary tools"
        ;;
esac