#!/bin/bash
# ONE COMMAND TO START ATLAS - Never breaks

# Kill any stuck processes
pkill -9 node 2>/dev/null
sleep 1

# Start fresh
cd /Users/jasoncarelse/atlas
npm run dev

# That's it. No complexity.