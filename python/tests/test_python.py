#!/usr/bin/env python3
"""
Unit tests for Python rsrcdump implementation
"""

import json
import os
import sys
import unittest
from pathlib import Path

# Add the rsrcdump module to the path
sys.path.insert(0, str(Path(__file__).parent.parent / 'rsrcdump'))

import rsrcdump

class TestPythonRsrcdump(unittest.TestCase):
    
    def setUp(self):
        self.test_file = Path(__file__).parent / 'EarthFarm.ter.rsrc'
        self.otto_specs = [
            "Hedr:L5i3f5i40x:version,numItems,mapWidth,mapHeight,numTilePages,numTiles,tileSize,minY,maxY,numSplines,numFences,numUniqueSupertiles,numWaterPatches,numCheckpoints",
            "Atrb:HBB+:flags,p0,p1", 
            "STgd:x?H+:isEmpty,superTileId",
            "Layr:H+",
            "YCrd:f+",
            "Itms:LLHBBBBH+:x,z,type,p0,p1,p2,p3,flags",
            "Spln:h 2x 4x i 4x h 2x 4x hhhh+:numNubs,numPoints,numItems,bbTop,bbLeft,bbBottom,bbRight",
            "SpNb:ff+:x,z",
            "SpPt:ff+:x,z", 
            "SpIt:fHBBBBH+:placement,type,p0,p1,p2,p3,flags",
            "Fenc:HhLhhhh+:fenceType,numNubs,junkNubListPtr,bbTop,bbLeft,bbBottom,bbRight",
            "FnNb:ii+",
            "Liqd:H x x I i h x x i 200f f f h h h h+:type,flags,height,numNubs,reserved,x`y[100],hotSpotX,hotSpotZ,bBoxTop,bBoxLeft,bBoxBottom,bBoxRight",
        ]

    def test_load_resource_fork(self):
        """Test loading the resource fork"""
        with open(self.test_file, 'rb') as f:
            data = f.read()
        
        fork = rsrcdump.load(self.test_file)
        self.assertIsNotNone(fork)
        
        # Check that we have the expected resource types
        expected_types = {b'Hedr', b'Atrb', b'STgd', b'Layr', b'YCrd', b'Itms', 
                         b'Spln', b'SpNb', b'SpPt', b'SpIt', b'Fenc', b'FnNb', b'Liqd'}
        actual_types = set(fork.tree.keys())
        
        self.assertTrue(expected_types.issubset(actual_types), 
                       f"Missing types: {expected_types - actual_types}")

    def test_convert_to_json(self):
        """Test converting resource fork to JSON with otto specs"""
        with open(self.test_file, 'rb') as f:
            data = f.read()
        
        json_str = rsrcdump.save_to_json(
            data,
            struct_specs=self.otto_specs
        )
        
        # Parse the JSON to ensure it's valid
        parsed = json.loads(json_str)
        
        # Check for expected structure
        self.assertIn('_metadata', parsed)
        self.assertIn('Hedr', parsed)
        self.assertIn('1000', parsed['Hedr'])
        
        # Check header values
        header = parsed['Hedr']['1000']['obj']
        self.assertEqual(header['version'], 134217728)
        self.assertEqual(header['mapWidth'], 176)
        self.assertEqual(header['mapHeight'], 176)
        
        # Save to file for comparison with TypeScript
        output_file = Path(__file__).parent / 'python_test_output.json'
        with open(output_file, 'w') as f:
            f.write(json_str)
        
        print(f"Python output saved to: {output_file}")

    def test_specific_resources(self):
        """Test parsing specific resource types"""
        fork = rsrcdump.load(self.test_file)
        
        # Check header resource exists
        self.assertIn(b'Hedr', fork.tree)
        self.assertIn(1000, fork.tree[b'Hedr'])
        
        header_resource = fork.tree[b'Hedr'][1000]
        self.assertEqual(len(header_resource.data), 96)  # Expected header size
        
        # Check items resource exists  
        self.assertIn(b'Itms', fork.tree)
        self.assertIn(1000, fork.tree[b'Itms'])
        
        items_resource = fork.tree[b'Itms'][1000]
        self.assertGreater(len(items_resource.data), 0)

if __name__ == '__main__':
    unittest.main()