#!/bin/bash

echo "Monitoring vt/reference directory..."
echo "Press Ctrl+C to stop"
echo "=============================="

# Watch the vt/reference directory for changes
while true; do
    echo ""
    echo "Current contents of vt/reference:"
    find vt/reference -type f -name "*.webp" | wc -l | xargs echo "Total webp files:"

    # Show recent files (last 5 modified)
    find vt/reference -type f -name "*.webp" -printf "%T@ %p\n" 2>/dev/null | sort -n | tail -5 | while read timestamp file; do
        date -d "@${timestamp%.*}" "+%H:%M:%S - $(basename "$file")"
    done

    echo "------------------------"
    sleep 2
done