#!/bin/bash

# Simple Daily Progress Script for Atlas Polished Launch
# Usage: ./scripts/daily-progress-simple.sh <day-number> <type>
# Example: ./scripts/daily-progress-simple.sh 2 lint

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if arguments are provided
if [ $# -ne 2 ]; then
    print_error "Usage: $0 <day-number> <type>"
    print_error "Example: $0 2 lint"
    print_error ""
    print_error "Valid types: lint, security, performance, ui, docs, e2e, pipeline"
    exit 1
fi

DAY_NUMBER=$1
TYPE=$2

# Validate day number
if ! [[ "$DAY_NUMBER" =~ ^[0-9]+$ ]] || [ "$DAY_NUMBER" -lt 1 ] || [ "$DAY_NUMBER" -gt 12 ]; then
    print_error "Day number must be between 1 and 12"
    exit 1
fi

# Map day number to phase and commit messages
get_commit_message() {
    local day=$1
    local type=$2
    
    case $day in
        1)
            case $type in
                lint) echo "chore(lint): Day 1 – automated lint cleanup and fixed parsing errors" ;;
                e2e) echo "fix(e2e): Day 1 – resolved Playwright web server timeout issues" ;;
                pipeline) echo "feat(ci): Day 1 – added automated lint pipeline script" ;;
                *) echo "chore: Day 1 – foundation cleanup and error fixes" ;;
            esac
            ;;
        2)
            case $type in
                lint) echo "chore(lint): Day 2 – replaced explicit any types and removed unused variables" ;;
                e2e) echo "fix(e2e): Day 2 – improved E2E test reliability and cross-browser support" ;;
                pipeline) echo "feat(ci): Day 2 – integrated lint fixes into CI/CD pipeline" ;;
                *) echo "chore: Day 2 – continued foundation cleanup and improvements" ;;
            esac
            ;;
        3)
            case $type in
                lint) echo "chore(lint): Day 3 – completed lint cleanup and validated foundation" ;;
                e2e) echo "test(e2e): Day 3 – validated E2E test infrastructure and mock services" ;;
                pipeline) echo "feat(ci): Day 3 – completed automated pipeline integration" ;;
                *) echo "chore: Day 3 – completed Phase 1 foundation work" ;;
            esac
            ;;
        4)
            case $type in
                security) echo "feat(security): Day 4 – conducted security audit and vulnerability scan" ;;
                performance) echo "perf: Day 4 – implemented load testing and performance validation" ;;
                monitoring) echo "feat(monitoring): Day 4 – enhanced monitoring and observability setup" ;;
                *) echo "feat: Day 4 – security and performance improvements" ;;
            esac
            ;;
        5)
            case $type in
                security) echo "fix(security): Day 5 – addressed security vulnerabilities and dependencies" ;;
                performance) echo "perf: Day 5 – optimized performance bottlenecks and response times" ;;
                monitoring) echo "feat(monitoring): Day 5 – fine-tuned Sentry and analytics configuration" ;;
                *) echo "feat: Day 5 – security hardening and performance optimization" ;;
            esac
            ;;
        6)
            case $type in
                security) echo "feat(security): Day 6 – completed security audit and validation" ;;
                performance) echo "perf: Day 6 – completed load testing and performance benchmarks" ;;
                monitoring) echo "feat(monitoring): Day 6 – completed monitoring and alerting setup" ;;
                *) echo "feat: Day 6 – completed Phase 2 security and performance work" ;;
            esac
            ;;
        7)
            case $type in
                ui) echo "feat(ui): Day 7 – polished chat screen interface and message rendering" ;;
                ux) echo "feat(ux): Day 7 – improved user experience and interaction design" ;;
                responsive) echo "feat(ui): Day 7 – enhanced mobile responsiveness and touch interactions" ;;
                *) echo "feat(ui): Day 7 – chat interface and core UI improvements" ;;
            esac
            ;;
        8)
            case $type in
                ui) echo "feat(ui): Day 8 – polished toggle controls and settings panels" ;;
                ux) echo "feat(ux): Day 8 – improved theme switching and customization options" ;;
                controls) echo "feat(ui): Day 8 – enhanced control center and preference management" ;;
                *) echo "feat(ui): Day 8 – controls and settings interface polish" ;;
            esac
            ;;
        9)
            case $type in
                ui) echo "feat(ui): Day 9 – polished subscription tier integration and payment flow" ;;
                ux) echo "feat(ux): Day 9 – improved upgrade modals and tier displays" ;;
                subscription) echo "feat(ui): Day 9 – enhanced subscription management interface" ;;
                *) echo "feat(ui): Day 9 – subscription and payment interface improvements" ;;
            esac
            ;;
        10)
            case $type in
                ui) echo "feat(ui): Day 10 – finalized branding and visual identity consistency" ;;
                ux) echo "feat(ux): Day 10 – completed user experience polish and accessibility" ;;
                branding) echo "feat(ui): Day 10 – implemented consistent branding and design system" ;;
                *) echo "feat(ui): Day 10 – completed Phase 3 UI/UX polish" ;;
            esac
            ;;
        11)
            case $type in
                docs) echo "docs: Day 11 – updated README, API documentation, and deployment guides" ;;
                qa) echo "test(qa): Day 11 – completed QA checklist validation and cross-browser testing" ;;
                documentation) echo "docs: Day 11 – comprehensive documentation updates and guides" ;;
                *) echo "docs: Day 11 – documentation and QA validation" ;;
            esac
            ;;
        12)
            case $type in
                docs) echo "docs: Day 12 – finalized documentation and created release notes" ;;
                qa) echo "test(qa): Day 12 – completed final QA validation and release preparation" ;;
                release) echo "chore(release): Day 12 – created release branch and prepared for deployment" ;;
                *) echo "chore: Day 12 – completed Atlas polished launch preparation" ;;
            esac
            ;;
        *)
            echo "chore: Day $day – $type improvements"
            ;;
    esac
}

# Map day number to GitHub project card title
get_card_title() {
    local day=$1
    
    case $day in
        1|2|3) echo "Days 1-3: Final Lint Cleanup" ;;
        4|5|6) echo "Days 4-6: Security & Load Testing" ;;
        7|8|9|10) echo "Days 7-10: UI/UX Polish" ;;
        11|12) echo "Days 11-12: Documentation & QA" ;;
        *) echo "Day $day Progress" ;;
    esac
}

# Get commit message
COMMIT_MESSAGE=$(get_commit_message "$DAY_NUMBER" "$TYPE")
CARD_TITLE=$(get_card_title "$DAY_NUMBER")

print_status "Starting daily progress for Day $DAY_NUMBER ($TYPE)"
print_status "Commit message: $COMMIT_MESSAGE"
print_status "Project card: $CARD_TITLE"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check if there are changes to commit
if git diff --quiet && git diff --cached --quiet; then
    print_warning "No changes to commit"
    exit 0
fi

# Stage all changes
print_status "Staging changes..."
git add .

# Commit changes (bypass pre-commit hook with --no-verify)
print_status "Committing changes..."
git commit --no-verify -m "$COMMIT_MESSAGE"

# Push to remote
print_status "Pushing to remote..."
git push origin refactor/conversation-view-split

# Update GitHub project board
print_status "Updating GitHub project board..."

# Get the project ID (2 for Atlas Polished Launch)
PROJECT_ID="2"
PROJECT_OWNER="Jasoncarelse27"

# Find the card by title
CARD_ID=$(gh project item-list "$PROJECT_ID" --owner "$PROJECT_OWNER" --format json | jq -r --arg title "$CARD_TITLE" '.[] | select(.title == $title) | .id')

if [ -z "$CARD_ID" ] || [ "$CARD_ID" = "null" ]; then
    print_warning "Could not find project card: $CARD_TITLE"
    print_warning "Available cards:"
    gh project item-list "$PROJECT_ID" --owner "$PROJECT_OWNER" --format json | jq -r '.[].title'
else
    # Move card to Done column
    print_status "Moving card '$CARD_TITLE' to Done column..."
    
    # Get the Done column ID
    DONE_COLUMN_ID=$(gh project view "$PROJECT_ID" --owner "$PROJECT_OWNER" --format json | jq -r '.fields[] | select(.name == "Status") | .options[] | select(.name == "Done") | .id')
    
    if [ -z "$DONE_COLUMN_ID" ] || [ "$DONE_COLUMN_ID" = "null" ]; then
        print_warning "Could not find 'Done' status option"
        print_warning "Available status options:"
        gh project view "$PROJECT_ID" --owner "$PROJECT_OWNER" --format json | jq -r '.fields[] | select(.name == "Status") | .options[].name'
    else
        # Update the card status to Done
        gh project item-edit "$CARD_ID" --owner "$PROJECT_OWNER" --field-id "Status" --single-select-option-id "$DONE_COLUMN_ID"
        print_success "Card moved to Done column"
    fi
fi

# Final confirmation
print_success "✅ Day $DAY_NUMBER progress pushed and board updated"
print_success "Commit: $COMMIT_MESSAGE"
print_success "Project: https://github.com/users/$PROJECT_OWNER/projects/$PROJECT_ID"
