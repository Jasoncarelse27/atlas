#!/bin/bash
# Supabase Migration Helper Script
# Quick access to common migration commands

set -e

PROJECT_DIR="/Users/jasoncarelse/atlas"
cd "$PROJECT_DIR"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️  Supabase Migration Helper${NC}"
echo ""

# Show menu
show_menu() {
  echo "Select an option:"
  echo ""
  echo "  1) Create new migration"
  echo "  2) List all migrations"
  echo "  3) Check migration status (remote)"
  echo "  4) Apply migrations to remote (push)"
  echo "  5) Pull schema from remote"
  echo "  6) View difference (local vs remote)"
  echo "  7) Open migration folder"
  echo "  8) Count migrations"
  echo "  9) Update Supabase CLI"
  echo "  0) Exit"
  echo ""
}

# Create new migration
create_migration() {
  echo -e "${BLUE}Creating new migration...${NC}"
  read -p "Enter migration name (e.g., add_users_table): " name
  
  if [ -z "$name" ]; then
    echo -e "${YELLOW}❌ Migration name cannot be empty${NC}"
    return
  fi
  
  supabase migration new "$name"
  echo -e "${GREEN}✅ Migration created!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Edit the new migration file in supabase/migrations/"
  echo "  2. Test locally if possible (requires Docker)"
  echo "  3. Apply to remote: supabase db push"
}

# List migrations
list_migrations() {
  echo -e "${BLUE}📋 Local migrations:${NC}"
  echo ""
  ls -1 supabase/migrations/*.sql | tail -20
  echo ""
  echo -e "${GREEN}Total: $(ls -1 supabase/migrations/*.sql | wc -l | xargs) migrations${NC}"
}

# Check remote status
check_status() {
  echo -e "${BLUE}Checking remote migration status...${NC}"
  echo ""
  supabase migration list --remote || echo -e "${YELLOW}⚠️  Could not fetch remote status${NC}"
}

# Push migrations
push_migrations() {
  echo -e "${YELLOW}⚠️  This will apply all pending migrations to production!${NC}"
  read -p "Are you sure? (yes/no): " confirm
  
  if [ "$confirm" = "yes" ]; then
    echo -e "${BLUE}Pushing migrations to remote...${NC}"
    supabase db push
    echo -e "${GREEN}✅ Migrations applied!${NC}"
  else
    echo -e "${YELLOW}❌ Cancelled${NC}"
  fi
}

# Pull schema
pull_schema() {
  echo -e "${BLUE}Pulling schema from remote...${NC}"
  echo ""
  supabase db pull
  echo -e "${GREEN}✅ Schema pulled${NC}"
}

# Show diff
show_diff() {
  echo -e "${BLUE}Comparing local vs remote...${NC}"
  echo ""
  supabase db diff --remote || echo -e "${YELLOW}⚠️  Could not compare${NC}"
}

# Open folder
open_folder() {
  echo -e "${BLUE}Opening migrations folder...${NC}"
  open supabase/migrations/
}

# Count migrations
count_migrations() {
  echo -e "${BLUE}📊 Migration Statistics:${NC}"
  echo ""
  total=$(ls -1 supabase/migrations/*.sql | wc -l | xargs)
  first=$(ls -1 supabase/migrations/*.sql | head -1 | xargs basename)
  last=$(ls -1 supabase/migrations/*.sql | tail -1 | xargs basename)
  
  echo "Total migrations: $total"
  echo "First: $first"
  echo "Latest: $last"
  echo ""
  
  # Count by year-month
  echo "Migrations by month:"
  ls -1 supabase/migrations/*.sql | cut -d'/' -f3 | cut -c1-6 | sort | uniq -c
}

# Update CLI
update_cli() {
  echo -e "${BLUE}Updating Supabase CLI...${NC}"
  brew upgrade supabase
  echo -e "${GREEN}✅ Supabase CLI updated${NC}"
  supabase --version
}

# Main loop
while true; do
  show_menu
  read -p "Enter choice [0-9]: " choice
  echo ""
  
  case $choice in
    1) create_migration ;;
    2) list_migrations ;;
    3) check_status ;;
    4) push_migrations ;;
    5) pull_schema ;;
    6) show_diff ;;
    7) open_folder ;;
    8) count_migrations ;;
    9) update_cli ;;
    0) echo -e "${GREEN}👋 Goodbye!${NC}"; exit 0 ;;
    *) echo -e "${YELLOW}❌ Invalid option${NC}" ;;
  esac
  
  echo ""
  read -p "Press Enter to continue..."
  clear
done

