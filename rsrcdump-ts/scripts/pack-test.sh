#!/bin/bash
# Script to test the packaged version

set -e

echo "Testing package build..."
npm run build

echo ""
echo "Running tests..."
npm test

echo ""
echo "Creating package..."
npm pack --dry-run

echo ""
echo "✓ Package is ready for publishing!"
echo ""
echo "To publish:"
echo "  npm publish --access public"
