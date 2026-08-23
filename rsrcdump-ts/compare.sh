#!/bin/bash
# Script to compare Python and TypeScript outputs

set -e

echo "Building TypeScript..."
npm run build

echo ""
echo "Extracting with Python..."
cd ..
python3 -c "
import rsrcdump
import json

with open('sample-specs.txt', 'r') as f:
    struct_specs = [line.strip() for line in f if line.strip() and not line.strip().startswith('//')]

with open('EarthFarm.ter.rsrc', 'rb') as f:
    data = f.read()

result = rsrcdump.save_to_json(data, struct_specs=struct_specs)
with open('/tmp/python_comparison.json', 'w') as f:
    f.write(result)

print('Python extraction complete')
"

echo ""
echo "Extracting with TypeScript..."
cd rsrcdump-ts
npm run cli extract ../EarthFarm.ter.rsrc /tmp/typescript_comparison.json ../sample-specs.txt

echo ""
echo "Comparing outputs..."
python3 -c "
import json
import sys

def compare_deep(py_val, ts_val, path='', errors=[]):
    if isinstance(py_val, (int, float)) and isinstance(ts_val, (int, float)):
        if abs(float(py_val) - float(ts_val)) > 0.0001:
            errors.append(f'Numeric difference at {path}: {py_val} vs {ts_val}')
        return
    
    if type(py_val) != type(ts_val):
        if isinstance(py_val, (int, float)) and isinstance(ts_val, (int, float)):
            return compare_deep(float(py_val), float(ts_val), path, errors)
        errors.append(f'Type mismatch at {path}: {type(py_val).__name__} vs {type(ts_val).__name__}')
        return
    
    if isinstance(py_val, dict):
        if set(py_val.keys()) != set(ts_val.keys()):
            errors.append(f'Key mismatch at {path}')
            return
        for key in py_val:
            compare_deep(py_val[key], ts_val[key], f'{path}.{key}', errors)
    elif isinstance(py_val, list):
        if len(py_val) != len(ts_val):
            errors.append(f'List length mismatch at {path}: {len(py_val)} vs {len(ts_val)}')
            return
        for i in range(min(len(py_val), 10)):  # Check first 10 items
            compare_deep(py_val[i], ts_val[i], f'{path}[{i}]', errors)
    elif py_val != ts_val:
        errors.append(f'Value mismatch at {path}: {py_val} vs {ts_val}')

with open('/tmp/python_comparison.json') as f:
    py_data = json.load(f)

with open('/tmp/typescript_comparison.json') as f:
    ts_data = json.load(f)

errors = []
compare_deep(py_data, ts_data, 'root', errors)

if errors:
    print('❌ Differences found:')
    for error in errors[:10]:  # Show first 10 errors
        print(f'  {error}')
    sys.exit(1)
else:
    print('✅ Python and TypeScript outputs are equivalent!')
    sys.exit(0)
"

echo ""
echo "Testing round-trip..."
npm run cli create /tmp/typescript_comparison.json /tmp/roundtrip.rsrc ../sample-specs.txt
npm run cli extract /tmp/roundtrip.rsrc /tmp/roundtrip.json ../sample-specs.txt

python3 -c "
import json

with open('/tmp/typescript_comparison.json') as f:
    original = json.load(f)

with open('/tmp/roundtrip.json') as f:
    roundtrip = json.load(f)

if original == roundtrip:
    print('✅ Round-trip successful!')
else:
    print('❌ Round-trip failed')
    exit(1)
"

echo ""
echo "All comparisons passed! ✅"
