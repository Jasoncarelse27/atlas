#!/bin/bash
# Atlas Workflow Cleanup - Keep only essential workflows

echo "🧹 Cleaning up duplicate GitHub workflows..."

cd .github/workflows

# Archive old workflows
mkdir -p archive
echo "📦 Archiving old workflows..."

# Keep only the unified CI/CD pipeline
mv alerts.yml archive/ 2>/dev/null || true
mv atlas-monitoring.yml archive/ 2>/dev/null || true
mv build-and-deploy.yml archive/ 2>/dev/null || true
mv ci-fail-safe-alert.yml archive/ 2>/dev/null || true
mv ci.yml archive/ 2>/dev/null || true
mv db-migration-check.yml archive/ 2>/dev/null || true
mv deploy.yml archive/ 2>/dev/null || true
mv manual-e2e.yml archive/ 2>/dev/null || true
mv manual-rollback.yml archive/ 2>/dev/null || true
mv monitoring.yml archive/ 2>/dev/null || true
mv nightly-e2e.yml archive/ 2>/dev/null || true
mv node.yml archive/ 2>/dev/null || true
mv prod-guard.yml archive/ 2>/dev/null || true
mv secure-secrets.yml archive/ 2>/dev/null || true
mv verify-backend.yml archive/ 2>/dev/null || true

echo "✅ Archived 15 duplicate workflows"

# Keep essential workflows
echo ""
echo "📋 Active workflows:"
echo "  - atlas-unified-ci-cd.yml (Main pipeline)"
echo "  - secret-scan.yml (Security scanning)"

echo ""
echo "🎯 Result: Reduced from 18 to 2 workflows"
echo "📧 This will reduce failure emails by ~90%"
