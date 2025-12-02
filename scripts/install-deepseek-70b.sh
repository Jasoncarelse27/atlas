#!/bin/bash
# 🚀 DeepSeek 70B Installation Script
# Installs DeepSeek-Coder-V2-Lite (70B) model using HuggingFace

set -e  # Exit on error
set -u  # Exit on undefined variables

echo "🚀 DeepSeek 70B Installation Script"
echo "=================================="
echo ""

# Configuration
MODEL_NAME="deepseek-ai/DeepSeek-Coder-V2-Lite"
MODEL_DIR="${MODEL_DIR:-/models}"
INSTALL_DIR="$MODEL_DIR/deepseek-70b"

# Check if running as root (for /models directory)
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

echo "📋 Configuration:"
echo "   Model: $MODEL_NAME"
echo "   Install directory: $INSTALL_DIR"
echo ""

# Step 1: Check disk space
echo "💾 Step 1: Checking disk space..."
AVAILABLE_SPACE=$(df -BG "$MODEL_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | sed 's/G//')
if [ -z "$AVAILABLE_SPACE" ]; then
    AVAILABLE_SPACE=$(df -BG ~ 2>/dev/null | tail -1 | awk '{print $4}' | sed 's/G//')
    INSTALL_DIR="$HOME/models/deepseek-70b"
fi

echo "   Available space: ${AVAILABLE_SPACE}GB"
if [ "$AVAILABLE_SPACE" -lt 140 ]; then
    echo "   ⚠️  WARNING: DeepSeek 70B requires ~140GB. You have ${AVAILABLE_SPACE}GB available."
    read -p "   Continue anyway? (yes/no): " CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        echo "❌ Installation cancelled."
        exit 1
    fi
else
    echo "   ✅ Sufficient disk space available."
fi

# Step 2: Create installation directory
echo ""
echo "📁 Step 2: Creating installation directory..."
$SUDO mkdir -p "$INSTALL_DIR"
$SUDO chown -R "$USER:$USER" "$INSTALL_DIR" 2>/dev/null || true
cd "$INSTALL_DIR"
echo "   ✅ Directory created: $INSTALL_DIR"

# Step 3: Check for Python and required packages
echo ""
echo "🐍 Step 3: Checking Python environment..."
if ! command -v python3 &> /dev/null; then
    echo "   ❌ Python3 not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip
fi

if ! command -v pip3 &> /dev/null; then
    echo "   ❌ pip3 not found. Installing..."
    sudo apt-get install -y python3-pip
fi

echo "   ✅ Python3 found: $(python3 --version)"
echo "   ✅ pip3 found: $(pip3 --version)"

# Step 4: Install HuggingFace CLI and transformers
echo ""
echo "📦 Step 4: Installing HuggingFace tools..."
pip3 install --user --upgrade huggingface_hub transformers accelerate 2>&1 | grep -E "(Requirement|Successfully|already)" || true
echo "   ✅ HuggingFace tools installed"

# Step 5: Check for HuggingFace token (optional but recommended)
echo ""
echo "🔑 Step 5: HuggingFace authentication..."
if [ -z "${HUGGINGFACE_TOKEN:-}" ]; then
    echo "   ℹ️  No HUGGINGFACE_TOKEN environment variable found."
    echo "   You can set it with: export HUGGINGFACE_TOKEN=your_token_here"
    echo "   (Optional - public models don't require authentication)"
    read -p "   Continue without token? (yes/no): " CONTINUE_NO_TOKEN
    if [ "$CONTINUE_NO_TOKEN" != "yes" ]; then
        echo "   Please set HUGGINGFACE_TOKEN and run again."
        exit 1
    fi
else
    echo "   ✅ HuggingFace token found"
    huggingface-cli login --token "$HUGGINGFACE_TOKEN" || true
fi

# Step 6: Download model
echo ""
echo "⬇️  Step 6: Downloading DeepSeek 70B model..."
echo "   This will take 30-60 minutes depending on your connection."
echo "   Model size: ~140GB"
echo ""

# Use huggingface-cli to download
if command -v huggingface-cli &> /dev/null; then
    echo "   Using huggingface-cli..."
    huggingface-cli download "$MODEL_NAME" --local-dir "$INSTALL_DIR" --local-dir-use-symlinks False
else
    echo "   Using Python script..."
    python3 << EOF
from huggingface_hub import snapshot_download
import os

print("Downloading model...")
snapshot_download(
    repo_id="$MODEL_NAME",
    local_dir="$INSTALL_DIR",
    local_dir_use_symlinks=False,
    resume_download=True
)
print("✅ Download complete!")
EOF
fi

# Step 7: Verify installation
echo ""
echo "✅ Step 7: Verifying installation..."
if [ -f "$INSTALL_DIR/config.json" ] || [ -f "$INSTALL_DIR/pytorch_model.bin" ] || [ -d "$INSTALL_DIR/snapshots" ]; then
    INSTALLED_SIZE=$(du -sh "$INSTALL_DIR" 2>/dev/null | cut -f1)
    echo "   ✅ Model installed successfully!"
    echo "   📊 Installed size: $INSTALLED_SIZE"
    echo "   📍 Location: $INSTALL_DIR"
else
    echo "   ⚠️  Warning: Model files not found. Installation may have failed."
    echo "   Please check the output above for errors."
    exit 1
fi

# Step 8: Create symlink for easy access
echo ""
echo "🔗 Step 8: Creating symlink..."
LINK_PATH="$MODEL_DIR/deepseek-70b-current"
if [ -L "$LINK_PATH" ]; then
    $SUDO rm "$LINK_PATH"
fi
$SUDO ln -s "$INSTALL_DIR" "$LINK_PATH"
echo "   ✅ Symlink created: $LINK_PATH -> $INSTALL_DIR"

# Step 9: Test loading (optional)
echo ""
read -p "🧪 Test model loading? (This will use ~70GB RAM) (yes/no): " TEST_MODEL
if [ "$TEST_MODEL" = "yes" ]; then
    echo "   Testing model loading..."
    python3 << EOF
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained("$INSTALL_DIR", trust_remote_code=True)
print("✅ Tokenizer loaded")

print("Loading model (this may take a few minutes)...")
model = AutoModelForCausalLM.from_pretrained(
    "$INSTALL_DIR",
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True
)
print("✅ Model loaded successfully!")
print("Model device:", next(model.parameters()).device)
print("Model dtype:", next(model.parameters()).dtype)
EOF
fi

echo ""
echo "✨ Installation complete!"
echo ""
echo "📋 Summary:"
echo "   Model: $MODEL_NAME"
echo "   Location: $INSTALL_DIR"
echo "   Symlink: $LINK_PATH"
echo ""
echo "💡 Next steps:"
echo "   1. Set MODEL_PATH=$INSTALL_DIR in your environment"
echo "   2. Configure your application to use this model"
echo "   3. Test inference with a sample prompt"
echo ""
echo "🔧 Example usage:"
echo "   export MODEL_PATH=$INSTALL_DIR"
echo "   python3 -c \"from transformers import AutoModelForCausalLM; model = AutoModelForCausalLM.from_pretrained('$INSTALL_DIR')\""

