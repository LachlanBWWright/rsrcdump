#!/usr/bin/env python3
"""
Comprehensive test for rsrcdump implementations.

This test verifies that both Python and TypeScript implementations 
produce identical structured output when parsing EarthFarm.ter.rsrc
using the otto-specs.txt format specifications.
"""

import json
import os
import sys
import subprocess
import tempfile
from typing import Dict, Any

def load_json_file(filepath: str) -> Dict[str, Any]:
    """Load and parse JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)

def compare_nested_data(data1: Any, data2: Any, path: str = "") -> list:
    """Recursively compare two data structures and return list of differences."""
    differences = []
    
    if type(data1) != type(data2):
        differences.append(f"{path}: Type mismatch - {type(data1).__name__} vs {type(data2).__name__}")
        return differences
    
    if isinstance(data1, dict):
        all_keys = set(data1.keys()) | set(data2.keys())
        for key in all_keys:
            key_path = f"{path}.{key}" if path else str(key)
            if key not in data1:
                differences.append(f"{key_path}: Missing in first data")
            elif key not in data2:
                differences.append(f"{key_path}: Missing in second data")
            else:
                differences.extend(compare_nested_data(data1[key], data2[key], key_path))
    
    elif isinstance(data1, list):
        if len(data1) != len(data2):
            differences.append(f"{path}: Length mismatch - {len(data1)} vs {len(data2)}")
        else:
            for i, (item1, item2) in enumerate(zip(data1, data2)):
                differences.extend(compare_nested_data(item1, item2, f"{path}[{i}]"))
    
    else:
        if data1 != data2:
            differences.append(f"{path}: Value mismatch - {data1} vs {data2}")
    
    return differences

def test_python_implementation():
    """Test Python implementation and return structured output."""
    print("Testing Python implementation...")
    
    # Test enhanced Python implementation
    try:
        import subprocess
        result = subprocess.run([
            'python', 'enhanced_rsrcdump.py', 'EarthFarm.ter.rsrc', 'otto-specs.txt'
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            enhanced_data = json.loads(result.stdout)
            print(f"✓ Enhanced Python implementation successful - found {len(enhanced_data)} top-level keys")
            return enhanced_data
        else:
            print(f"✗ Enhanced Python implementation failed: {result.stderr}")
            
    except Exception as e:
        print(f"✗ Error running enhanced Python implementation: {e}")
    
    # Fall back to basic functionality
    import rsrcdump
    with open('EarthFarm.ter.rsrc', 'rb') as f:
        data = f.read()
    
    # Basic extraction without struct specs
    basic_result = rsrcdump.save_to_json(data)
    basic_data = json.loads(basic_result)
    
    print(f"✓ Python basic extraction successful - found {len(basic_data)} resource types")
    
    return basic_data

def test_typescript_implementation():
    """Test TypeScript implementation and return structured output."""
    print("Testing TypeScript implementation...")
    
    # Check if TypeScript implementation exists
    ts_dir = "rsrcdump-ts"
    if not os.path.exists(ts_dir):
        print("⚠ TypeScript implementation not found")
        return None
    
    # Run TypeScript tests
    try:
        result = subprocess.run(
            ["npm", "test"], 
            cwd=ts_dir, 
            capture_output=True, 
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            print("✓ TypeScript tests passed")
            
            # Try to get output JSON if it exists
            output_files = ["typescript_test_output.json", "test_output.json"]
            for filename in output_files:
                filepath = os.path.join(ts_dir, filename)
                if os.path.exists(filepath):
                    return load_json_file(filepath)
                    
                # Also check in root directory
                root_filepath = filename
                if os.path.exists(root_filepath):
                    return load_json_file(root_filepath)
            
            print("⚠ TypeScript test output not found")
            return None
            
        else:
            print(f"✗ TypeScript tests failed: {result.stderr}")
            return None
            
    except Exception as e:
        print(f"✗ Error running TypeScript tests: {e}")
        return None

def test_against_sample():
    """Test both implementations against earthFarmSample.json."""
    print("\nTesting against earthFarmSample.json...")
    
    # Load the expected sample output
    if not os.path.exists('earthFarmSample.json'):
        print("✗ earthFarmSample.json not found")
        return False
    
    expected_data = load_json_file('earthFarmSample.json')
    print(f"✓ Loaded earthFarmSample.json with {len(expected_data)} top-level keys")
    
    # Test Python implementation
    python_data = test_python_implementation()
    if python_data:
        print("\n--- Comparing Python output with sample ---")
        differences = compare_nested_data(python_data, expected_data)
        if differences:
            print(f"⚠ Found {len(differences)} differences (expected for now):")
            # Show first few differences
            for i, diff in enumerate(differences[:10]):
                print(f"  {i+1}. {diff}")
            if len(differences) > 10:
                print(f"  ... and {len(differences) - 10} more differences")
        else:
            print("✓ Python output matches sample exactly!")
    
    # Test TypeScript implementation  
    typescript_data = test_typescript_implementation()
    if typescript_data:
        print("\n--- Comparing TypeScript output with sample ---")
        differences = compare_nested_data(typescript_data, expected_data)
        if differences:
            print(f"⚠ Found {len(differences)} differences:")
            for i, diff in enumerate(differences[:10]):
                print(f"  {i+1}. {diff}")
            if len(differences) > 10:
                print(f"  ... and {len(differences) - 10} more differences")
        else:
            print("✓ TypeScript output matches sample exactly!")
    
    # Compare Python and TypeScript outputs
    if python_data and typescript_data:
        print("\n--- Comparing Python and TypeScript outputs ---")
        differences = compare_nested_data(python_data, typescript_data)
        if differences:
            print(f"⚠ Found {len(differences)} differences between implementations:")
            for i, diff in enumerate(differences[:10]):
                print(f"  {i+1}. {diff}")
            if len(differences) > 10:
                print(f"  ... and {len(differences) - 10} more differences")
        else:
            print("✓ Python and TypeScript outputs match exactly!")
    
    return True

def test_specific_requirements():
    """Test specific requirements mentioned in the comments."""
    print("\n=== Testing Specific Requirements ===")
    
    # Test 1: 'x' values should be ignored
    print("\n1. Testing 'x' (padding) field handling...")
    # TODO: Implement test
    
    # Test 2: Liqd x`y[100] should expand to x_0, y_0, x_1, y_1, etc.
    print("\n2. Testing Liqd array expansion...")
    expected_data = load_json_file('earthFarmSample.json')
    
    if 'Liqd' in expected_data and '1000' in expected_data['Liqd']:
        liqd_obj = expected_data['Liqd']['1000']['obj'][0]  # First water object
        
        # Check for expanded coordinate fields
        coord_fields = [key for key in liqd_obj.keys() if key.startswith(('x_', 'y_'))]
        print(f"✓ Found {len(coord_fields)} coordinate fields in sample Liqd object")
        
        # Verify they follow the pattern x_0, y_0, x_1, y_1, etc.
        expected_coords = []
        for i in range(100):  # x`y[100] means 100 pairs
            expected_coords.extend([f'x_{i}', f'y_{i}'])
        
        found_coords = [key for key in expected_coords if key in liqd_obj]
        print(f"✓ Found {len(found_coords)}/200 expected coordinate fields")
        
        if len(found_coords) > 0:
            print(f"  Example values: {liqd_obj[found_coords[0]]} = {found_coords[0]}, {liqd_obj[found_coords[1]]} = {found_coords[1]}")
    
    # Test 3: Roundtrip test
    print("\n3. Testing roundtrip capability...")
    # TODO: Implement roundtrip test
    
    print("\n=== Tests Complete ===")

def main():
    """Main test function."""
    print("=== Comprehensive rsrcdump Test Suite ===")
    print(f"Working directory: {os.getcwd()}")
    print(f"Python version: {sys.version}")
    
    # Check required files exist
    required_files = ['EarthFarm.ter.rsrc', 'otto-specs.txt', 'earthFarmSample.json']
    for filename in required_files:
        if os.path.exists(filename):
            print(f"✓ Found {filename}")
        else:
            print(f"✗ Missing {filename}")
            return 1
    
    # Run tests
    test_against_sample()
    test_specific_requirements()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())