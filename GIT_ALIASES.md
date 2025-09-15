# Git Aliases for Enhanced Workflow

These aliases will help you maintain a consistent and efficient Git workflow.

## Installation

To install these aliases, run each command in your terminal:

```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual '!gitk'
git config --global alias.graph 'log --oneline --graph --all --decorate'
git config --global alias.today "log --since='1 day ago'"
git config --global alias.week "log --since='7 days ago'"
git config --global alias.month "log --since='30 days ago'"
git config --global alias.contributions "shortlog -sn --all"
git config --global alias.cleanup "!git branch --merged | grep -v '\\*' | xargs -n 1 git branch -d"
```

## Alias Descriptions

| Alias | Command | Description |
|-------|---------|-------------|
| st | status | Show working tree status |
| co | checkout | Switch branches or restore working tree files |
| br | branch | List, create, or delete branches |
| ci | commit | Record changes to the repository |
| unstage | reset HEAD -- | Unstage files |
| last | log -1 HEAD | Show the last commit |
| visual | !gitk | Open gitk GUI |
| graph | log --oneline --graph --all --decorate | Show commit graph |
| today | log --since='1 day ago' | Show commits from today |
| week | log --since='7 days ago' | Show commits from the past week |
| month | log --since='30 days ago' | Show commits from the past month |
| contributions | shortlog -sn --all | Show contribution statistics |
| cleanup | !git branch --merged \| grep -v '\\*' \| xargs -n 1 git branch -d | Delete merged branches |

## Custom Workflow Commands

### Daily Summary
```bash
git config --global alias.daily "log --since='1 day ago' --oneline --author=$(git config user.email)"
```

### Weekly Report
```bash
git config --global alias.weekly "log --since='7 days ago' --oneline --author=$(git config user.email)"
```

### Feature Branch Creation
```bash
git config --global alias.feature "!f() { git checkout -b feature/$1; }; f"
```

Usage: `git feature new-login-flow`

### Hotfix Branch Creation
```bash
git config --global alias.hotfix "!f() { git checkout -b hotfix/$1; }; f"
```

Usage: `git hotfix login-bug`

### Publish Current Branch
```bash
git config --global alias.publish "!git push -u origin \$(git rev-parse --abbrev-ref HEAD)"
```

Usage: `git publish` (pushes and sets upstream for current branch)

These aliases will help you maintain a consistent workflow and make it easier to track your contributions.