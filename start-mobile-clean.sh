#!/usr/bin/env bash
# Mobile dev (safe): ensure Node 20, clean caches, start Expo
export PATH="/opt/homebrew/opt/node@20/bin:$PATH" && node -v \
&& cd atlas-mobile \
&& rm -rf node_modules/.cache .expo \
&& npx expo start -c
