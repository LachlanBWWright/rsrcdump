#!/bin/bash
# Compare Python and TypeScript outputs

set -e

RSRC_FILE="../EarthFarm.ter.rsrc"
SPECS_FILE="../sample-specs.txt"
PY_OUT="/tmp/python_compare.json"
TS_OUT="/tmp/typescript_compare.json"

echo "=== rsrcdump Comparison: Python vs TypeScript ==="
echo ""

# Check if Python rsrcdump is available
if ! command -v rsrcdump &> /dev/null; then
    echo "⚠ Python rsrcdump not installed"
    echo "Skipping Python comparison"
    PY_AVAILABLE=false
else
    PY_AVAILABLE=true
fi

# Extract with TypeScript
echo "Extracting with TypeScript..."
npm run cli extract "$RSRC_FILE" "$TS_OUT" "$SPECS_FILE" > /dev/null 2>&1
echo "✓ TypeScript extraction complete: $TS_OUT"

# Extract with Python if available
if [ "$PY_AVAILABLE" = true ]; then
    echo ""
    echo "Extracting with Python..."
    rsrcdump --extract --struct-file "$SPECS_FILE" "$RSRC_FILE" -o "$PY_OUT" > /dev/null 2>&1
    echo "✓ Python extraction complete: $PY_OUT"
    
    echo ""
    echo "Comparing outputs..."
    
    # Compare file sizes
    PY_SIZE=$(wc -c < "$PY_OUT")
    TS_SIZE=$(wc -c < "$TS_OUT")
    
    echo "  Python output: $PY_SIZE bytes"
    echo "  TypeScript output: $TS_SIZE bytes"
    
    # Simple JSON structure comparison
    PY_KEYS=$(cat "$PY_OUT" | jq -r 'keys | .[]' | sort)
    TS_KEYS=$(cat "$TS_OUT" | jq -r 'keys | .[]' | sort)
    
    if [ "$PY_KEYS" = "$TS_KEYS" ]; then
        echo "  ✓ Resource types match"
    else
        echo "  ✗ Resource types differ"
    fi
fi

echo ""
echo "TypeScript output details:"
npm run cli list "$RSRC_FILE" 2> /dev/null | head -20

echo ""
echo "=== Comparison complete ==="
