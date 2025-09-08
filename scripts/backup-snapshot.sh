#!/usr/bin/env bash
set -euo pipefail
ts=$(date +"%Y-%m-%d_%H-%M-%S")
out=".backups/atlas_${ts}.tar.gz"
echo "🗂  Creating snapshot $out"
git ls-files -z | tar --null -czf "$out" -T -
echo "✅ Snapshot saved to $out"
