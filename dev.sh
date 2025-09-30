#!/bin/bash
# 🚀 Atlas Dev Launcher - choose Native or Web

echo "====================================="
echo "   Atlas Dev Launcher"
echo "====================================="
echo "1) Start Native (Expo Go / Simulator)"
echo "2) Start Web (Browser)"
echo "====================================="

read -p "Select option [1-2]: " choice

if [ "$choice" == "1" ]; then
  echo "📱 Starting Expo (Native)..."
  npx expo start
elif [ "$choice" == "2" ]; then
  echo "🌍 Starting Expo (Web)..."
  npx expo start --web
else
  echo "❌ Invalid choice"
fi