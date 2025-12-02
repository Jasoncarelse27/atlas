#!/bin/bash
# 🔍 Safe LLaMA 70B Uninstall Script
# Prepares system for DeepSeek 70B installation

set -e  # Exit on error
set -u  # Exit on undefined variables

echo "🔍 Step 1: Locating LLaMA 70B model directories..."
echo ""

# Check common model storage locations
MODEL_DIRS=("/models" "/usr/local/models" "/opt/models" "$HOME/models" "/var/models")
FOUND_DIRS=()

for dir in "${MODEL_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ Found: $dir"
        # Look for LLaMA-related folders
        if ls "$dir"/*llama* 2>/dev/null || ls "$dir"/*70b* 2>/dev/null; then
            echo "   📦 Contains potential LLaMA models:"
            ls -lh "$dir" | grep -i "llama\|70b" || echo "   (none found)"
            FOUND_DIRS+=("$dir")
        fi
    fi
done

if [ ${#FOUND_DIRS[@]} -eq 0 ]; then
    echo "⚠️  No model directories found in common locations."
    echo "   Checking current directory and home directory..."
    ls -lh . 2>/dev/null | grep -i "llama\|70b" || echo "   (none found in current dir)"
    ls -lh ~ 2>/dev/null | grep -i "llama\|70b" || echo "   (none found in home)"
fi

echo ""
echo "📋 Step 2: Model Removal"
echo "─────────────────────────────────────────────────"
read -p "Enter the FULL path to the LLaMA 70B model folder (or 'skip' to skip): " MODEL_PATH

if [ "$MODEL_PATH" = "skip" ] || [ -z "$MODEL_PATH" ]; then
    echo "⏭️  Skipping model removal."
else
    # Safety check: ensure path contains "llama" or "70b"
    if [[ ! "$MODEL_PATH" =~ (llama|70b) ]]; then
        echo "⚠️  WARNING: Path doesn't contain 'llama' or '70b'"
        read -p "Are you sure you want to delete '$MODEL_PATH'? (yes/no): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            echo "❌ Aborted. No deletion performed."
            exit 1
        fi
    fi
    
    if [ -d "$MODEL_PATH" ]; then
        # Show size before deletion
        SIZE=$(du -sh "$MODEL_PATH" 2>/dev/null | cut -f1)
        echo "📊 Model size: $SIZE"
        read -p "⚠️  Delete '$MODEL_PATH' ($SIZE)? (yes/no): " CONFIRM_DELETE
        
        if [ "$CONFIRM_DELETE" = "yes" ]; then
            echo "🗑️  Removing model at: $MODEL_PATH"
            sudo rm -rf "$MODEL_PATH"
            echo "✅ Model removed successfully."
        else
            echo "❌ Deletion cancelled."
        fi
    else
        echo "❌ Path not found: $MODEL_PATH"
        echo "   No deletion performed."
    fi
fi

echo ""
echo "🧽 Step 3: Cache Cleanup"
echo "─────────────────────────────────────────────────"

# Show cache sizes before deletion
echo "📊 Current cache sizes:"
if [ -d ~/.cache/huggingface ]; then
    HF_SIZE=$(du -sh ~/.cache/huggingface 2>/dev/null | cut -f1)
    echo "   HuggingFace: $HF_SIZE"
else
    echo "   HuggingFace: (not found)"
fi

if [ -d ~/.cache/torch ]; then
    TORCH_SIZE=$(du -sh ~/.cache/torch 2>/dev/null | cut -f1)
    echo "   PyTorch: $TORCH_SIZE"
else
    echo "   PyTorch: (not found)"
fi

read -p "Clean HuggingFace and PyTorch caches? (yes/no): " CLEAN_CACHE

if [ "$CLEAN_CACHE" = "yes" ]; then
    echo "🧹 Cleaning caches..."
    
    # More targeted cleanup (preserves some useful cache)
    rm -rf ~/.cache/huggingface/transformers 2>/dev/null && echo "   ✅ HuggingFace transformers cache cleared"
    rm -rf ~/.cache/huggingface/hub 2>/dev/null && echo "   ✅ HuggingFace hub cache cleared"
    rm -rf ~/.cache/torch 2>/dev/null && echo "   ✅ PyTorch cache cleared"
    
    echo "✅ Cache cleanup complete."
else
    echo "⏭️  Skipping cache cleanup."
fi

echo ""
echo "✨ Cleanup complete! System ready for DeepSeek 70B installation."
echo ""
echo "💡 Next steps:"
echo "   1. Verify disk space: df -h"
echo "   2. Run: bash install-deepseek-70b.sh"
echo "   3. Configure model path in your application"

