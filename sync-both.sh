#!/bin/bash
# Sync to both GitHub and Google Earth Engine

echo "🔄 Pushing to GitHub..."
git push github master

echo "🔄 Pushing to Google Earth Engine..."
git push gee master

echo "✅ Synced to both GitHub and GEE!"