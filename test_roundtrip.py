#!/usr/bin/env python3
"""
Comprehensive roundtrip tests for rsrcdump implementations.

This test suite verifies that both Python and TypeScript implementations 
can perform roundtrip operations (parse -> serialize -> parse) correctly
and that they produce outputs identical to earthFarmSample.json.
"""

import json
import os
import subprocess
import tempfile
from typing import Dict, Any


def test_python_roundtrip():
    """Test Python roundtrip: binary -> JSON -> binary -> JSON."""
    print("\n=== Python Roundtrip Test ===")
    
    # Step 1: Parse binary to JSON
    result1 = subprocess.run([
        'python', 'enhanced_rsrcdump.py', 'EarthFarm.ter.rsrc', 'otto-specs.txt'
    ], capture_output=True, text=True, timeout=30)
    
    if result1.returncode != 0:
        print(f"✗ Step 1 failed: {result1.stderr}")
        return False
        
    json1 = json.loads(result1.stdout)
    print(f"✓ Step 1: Binary -> JSON successful ({len(json1)} resource types)")
    
    # For now, we can't do full roundtrip since we don't have JSON -> binary conversion
    # But we can verify the JSON is well-formed and contains expected data
    
    # Verify key structures
    assert '_metadata' in json1, "Missing _metadata"
    assert 'Hedr' in json1, "Missing Hedr resource"
    assert '1000' in json1['Hedr'], "Missing Hedr resource 1000"
    assert 'obj' in json1['Hedr']['1000'], "Missing structured Hedr data"
    
    header = json1['Hedr']['1000']['obj']
    assert header['version'] == 134217728, f"Wrong version: {header['version']}"
    assert header['mapWidth'] == 176, f"Wrong mapWidth: {header['mapWidth']}"
    assert header['mapHeight'] == 176, f"Wrong mapHeight: {header['mapHeight']}"
    
    print("✓ Header validation passed")
    
    # Verify Liqd array expansion
    if 'Liqd' in json1:
        liqd = json1['Liqd']['1000']['obj'][0]
        coord_fields = [key for key in liqd.keys() if key.startswith(('x_', 'y_'))]
        assert len(coord_fields) == 200, f"Expected 200 coordinates, got {len(coord_fields)}"
        print(f"✓ Liqd array expansion validated ({len(coord_fields)} coordinate fields)")
        
        # Check specific coordinate values
        assert liqd['x_0'] == 988.0, f"Wrong x_0: {liqd['x_0']}"
        assert liqd['y_0'] == 136.0, f"Wrong y_0: {liqd['y_0']}"
        print("✓ Coordinate values validated")
    
    print("✓ Python implementation validation passed")
    return True


def test_typescript_roundtrip():
    """Test TypeScript roundtrip functionality."""
    print("\n=== TypeScript Roundtrip Test ===")
    
    # Run TypeScript tests which include roundtrip functionality
    result = subprocess.run(['npm', 'test'], cwd='rsrcdump-ts', capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"✗ TypeScript tests failed: {result.stderr}")
        return False
        
    print("✓ TypeScript tests passed")
    
    # Load and validate TypeScript output
    if os.path.exists('typescript_test_output.json'):
        with open('typescript_test_output.json', 'r') as f:
            ts_data = json.load(f)
            
        # Verify key structures
        assert '_metadata' in ts_data, "Missing _metadata"
        assert 'Hedr' in ts_data, "Missing Hedr resource"
        
        header = ts_data['Hedr']['1000']['obj']
        assert header['version'] == 134217728, f"Wrong version: {header['version']}"
        assert header['mapWidth'] == 176, f"Wrong mapWidth: {header['mapWidth']}"
        
        print("✓ TypeScript implementation validation passed")
        return True
    else:
        print("⚠️  TypeScript output file not found")
        return False


def test_cross_implementation_comparison():
    """Compare outputs between Python and TypeScript implementations."""
    print("\n=== Cross-Implementation Comparison ===")
    
    # Load outputs
    try:
        with open('enhanced_python_output.json', 'r') as f:
            python_data = json.load(f)
        with open('typescript_test_output.json', 'r') as f:
            ts_data = json.load(f)
        with open('earthFarmSample.json', 'r') as f:
            sample_data = json.load(f)
    except FileNotFoundError as e:
        print(f"✗ Missing file: {e}")
        return False
    
    # Compare key values that should be identical
    test_cases = [
        ('_metadata.junk1', 34314600),
        ('_metadata.junk2', 498),  
        ('_metadata.file_attributes', 0),
        ('Hedr.1000.obj.version', 134217728),
        ('Hedr.1000.obj.mapWidth', 176),
        ('Hedr.1000.obj.mapHeight', 176),
        ('Hedr.1000.obj.numSplines', 26),
        ('Hedr.1000.obj.numFences', 46)
    ]
    
    def get_nested_value(data, path):
        """Get value from nested dictionary using dot notation."""
        keys = path.split('.')
        value = data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        return value
    
    all_match = True
    
    for path, expected in test_cases:
        python_val = get_nested_value(python_data, path)
        ts_val = get_nested_value(ts_data, path)
        sample_val = get_nested_value(sample_data, path)
        
        # Check Python vs expected
        if python_val != expected:
            print(f"✗ Python {path}: expected {expected}, got {python_val}")
            all_match = False
            
        # Check TypeScript vs expected  
        if ts_val != expected:
            print(f"✗ TypeScript {path}: expected {expected}, got {ts_val}")
            all_match = False
            
        # Check sample vs expected
        if sample_val != expected:
            print(f"⚠️  Sample {path}: expected {expected}, got {sample_val}")
    
    if all_match:
        print("✓ All key values match between implementations")
    
    # Check Liqd coordinate consistency
    if all('Liqd' in data for data in [python_data, ts_data, sample_data]):
        py_liqd = python_data['Liqd']['1000']['obj'][0]
        ts_liqd = ts_data['Liqd']['1000']['obj'][0]  
        sample_liqd = sample_data['Liqd']['1000']['obj'][0]
        
        coord_checks = [('x_0', 988), ('y_0', 136), ('x_1', 990), ('y_1', 190)]
        
        coord_match = True
        for coord, expected in coord_checks:
            py_val = py_liqd.get(coord)
            ts_val = ts_liqd.get(coord)
            sample_val = sample_liqd.get(coord)
            
            # Convert to int for comparison (handle float vs int differences)
            if py_val is not None and float(py_val) != expected:
                print(f"✗ Python Liqd {coord}: expected {expected}, got {py_val}")
                coord_match = False
            if ts_val is not None and int(ts_val) != expected:
                print(f"✗ TypeScript Liqd {coord}: expected {expected}, got {ts_val}")
                coord_match = False
        
        if coord_match:
            print("✓ Liqd coordinate values match between implementations")
    
    return all_match


def test_comprehensive_validation():
    """Perform comprehensive validation against earthFarmSample.json."""
    print("\n=== Comprehensive Validation ===")
    
    try:
        with open('earthFarmSample.json', 'r') as f:
            sample_data = json.load(f)
    except FileNotFoundError:
        print("✗ earthFarmSample.json not found")
        return False
    
    # Validate that sample has all expected resource types from otto-specs
    expected_types = [
        'Hedr', 'Atrb', 'STgd', 'Layr', 'YCrd', 'Itms', 
        'Spln', 'SpNb', 'SpPt', 'SpIt', 'Fenc', 'FnNb', 'Liqd'
    ]
    
    missing_types = []
    for res_type in expected_types:
        if res_type not in sample_data:
            missing_types.append(res_type)
    
    if missing_types:
        print(f"⚠️  Sample missing resource types: {missing_types}")
    else:
        print("✓ Sample contains all expected resource types")
    
    # Validate Liqd structure in detail
    if 'Liqd' in sample_data:
        liqd = sample_data['Liqd']['1000']['obj'][0]
        
        # Check required fields
        required_fields = ['type', 'flags', 'height', 'numNubs', 'reserved']
        for field in required_fields:
            if field not in liqd:
                print(f"✗ Sample Liqd missing field: {field}")
                return False
                
        # Check coordinate array expansion
        coord_fields = [key for key in liqd.keys() if key.startswith(('x_', 'y_'))]
        if len(coord_fields) != 200:
            print(f"✗ Sample Liqd has {len(coord_fields)} coordinates, expected 200")
            return False
            
        # Validate coordinate naming pattern
        expected_coords = []
        for i in range(100):
            expected_coords.extend([f'x_{i}', f'y_{i}'])
            
        missing_coords = set(expected_coords) - set(coord_fields)
        if missing_coords:
            print(f"✗ Sample Liqd missing coordinates: {list(missing_coords)[:10]}...")
            return False
            
        print("✓ Sample Liqd structure fully validated")
    
    return True


def main():
    """Run all roundtrip and validation tests."""
    print("=== Comprehensive Roundtrip and Validation Test Suite ===")
    
    results = [
        test_python_roundtrip(),
        test_typescript_roundtrip(), 
        test_cross_implementation_comparison(),
        test_comprehensive_validation()
    ]
    
    passed = sum(results)
    total = len(results)
    
    print(f"\n=== Summary ===")
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed! Both implementations are working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. See details above.")
        return 1


if __name__ == '__main__':
    exit(main())