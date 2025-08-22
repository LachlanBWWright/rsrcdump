#!/usr/bin/env python3
"""
Enhanced Python rsrcdump with otto-specs support.

This provides structured output parsing using otto-specs.txt that matches
the expected earthFarmSample.json format.
"""

import json
import sys
import os
import re
from typing import Dict, List, Any, Optional, Tuple, Union

# Import the original rsrcdump library
import rsrcdump


class EnhancedStructTemplate:
    """Enhanced struct template that handles x fields and array expansion."""
    
    def __init__(self, format_str: str, field_names: List[str]):
        self.original_format = format_str
        self.field_names = field_names
        self.is_list = False
        
        # Check for list indicator
        if format_str.endswith('+'):
            self.is_list = True
            format_str = format_str[:-1]
        
        # Add endianness if not specified
        if not format_str.startswith(('!', '>', '<', '@', '=')):
            format_str = '>' + format_str
            
        self.format_str = format_str
        
        # Parse the format to get individual field types
        self.field_formats = self._parse_format_fields(format_str)
        
        # Expand field names to handle arrays and x fields
        self.expanded_field_names = self._expand_field_names()
        
        # Calculate record length
        import struct
        self.record_length = struct.calcsize(format_str)
    
    def _parse_format_fields(self, fmt: str) -> List[str]:
        """Parse format string into individual field types."""
        fields = []
        i = 0
        repeat = 0
        
        # Skip endianness prefix
        if fmt[0] in '!@=<>':
            i = 1
            
        while i < len(fmt):
            c = fmt[i]
            
            # Skip whitespace
            if c.isspace():
                i += 1
                continue
                
            # Handle repeat count
            if c.isdigit():
                repeat = repeat * 10 + int(c)
                i += 1
                continue
                
            # Handle format characters
            if c.upper() in 'CB?HILFQD' or c == 'x':
                for _ in range(max(repeat, 1)):
                    fields.append(c)
                repeat = 0
            elif c == 's':
                fields.append(f'{max(repeat, 1)}{c}')
                repeat = 0
            else:
                raise ValueError(f"Unsupported struct format character '{c}'")
                
            i += 1
            
        return fields
    
    def _expand_field_names(self) -> List[Optional[str]]:
        """Expand field names to handle arrays and mark x fields as None."""
        result = []
        field_name_index = 0
        field_index = 0
        
        while field_index < len(self.field_formats) and field_name_index < len(self.field_names):
            field_type = self.field_formats[field_index]
            field_name = self.field_names[field_name_index]
            
            # Skip 'x' (padding) fields - they should be ignored completely
            if field_type == 'x':
                result.append(None)
                field_index += 1
                continue
                
            # Handle array expansion like x`y[100] -> x_0, y_0, x_1, y_1, ...
            if '`' in field_name and '[' in field_name and ']' in field_name:
                expanded_names = self._expand_array_field_names(field_name, field_index)
                result.extend(expanded_names)
                field_index += len(expanded_names)
                field_name_index += 1
            else:
                result.append(field_name)
                field_index += 1
                field_name_index += 1
                
        # Fill remaining fields with None
        while field_index < len(self.field_formats):
            result.append(None)
            field_index += 1
            
        return result
        
    def _expand_array_field_names(self, field_name: str, start_field_index: int) -> List[str]:
        """Expand array field names like x`y[100] to x_0, y_0, x_1, y_1, ..."""
        match = re.match(r'^(.+?)`(.+?)\[(\d+)\]$', field_name)
        if not match:
            return [field_name]
            
        prefix, suffix, count_str = match.groups()
        count = int(count_str)
        
        # Count available non-x fields starting from start_field_index
        available_fields = 0
        for i in range(start_field_index, len(self.field_formats)):
            if self.field_formats[i] != 'x':
                available_fields += 1
            else:
                break  # Stop at first x field
                
        # Generate pairs: x_0, y_0, x_1, y_1, ... up to available field count
        result = []
        num_pairs = min(count, available_fields // 2)
        
        for i in range(num_pairs):
            result.append(f'{prefix}_{i}')
            result.append(f'{suffix}_{i}')
            
        return result
    
    def unpack_data(self, data: bytes, offset: int = 0) -> Any:
        """Unpack binary data using this template."""
        import struct
        
        # Unpack the raw values using the format string
        # Note: 'x' fields in struct format don't produce values, they're just padding
        raw_values = struct.unpack_from(self.format_str, data, offset)
        
        # Create a full values array that includes None for x fields
        full_values = []
        value_index = 0
        
        for field_type in self.field_formats:
            if field_type == 'x':
                # x fields don't produce values in struct.unpack, so add None placeholder
                full_values.append(None)
            else:
                # This field produces a value
                if value_index < len(raw_values):
                    full_values.append(raw_values[value_index])
                    value_index += 1
                else:
                    full_values.append(None)
        
        # Now map values to field names, filtering out None values and None field names
        result = {}
        
        for value, field_name in zip(full_values, self.expanded_field_names):
            if field_name is not None and value is not None:  # Skip None (x fields) and None field names
                result[field_name] = value
                
        return result


class OttoSpecsConverter:
    """Converter that uses otto-specs.txt for structured parsing."""
    
    def __init__(self, specs_file_path: str):
        self.converters = {}
        self._load_specs(specs_file_path)
    
    def _load_specs(self, specs_file_path: str):
        """Load otto specs from file."""
        with open(specs_file_path, 'r') as f:
            lines = f.readlines()
            
        for line in lines:
            line = line.strip()
            if not line or line.startswith('//'):
                continue
                
            try:
                self._parse_spec_line(line)
            except Exception as e:
                print(f"Warning: Failed to parse spec line: {line} - {e}", file=sys.stderr)
    
    def _parse_spec_line(self, line: str):
        """Parse a single spec line like 'Hedr:L5i3f5i40x:version,numItems,...'"""
        # Handle special cases like comments embedded in lines
        if '//' in line:
            line = line.split('//')[0].strip()
            
        parts = line.split(':', 2)
        if len(parts) < 2:
            return
            
        restype = parts[0].strip()
        format_str = parts[1].strip()
        
        # Remove any trailing commas or spaces
        format_str = format_str.rstrip(', ')
        
        field_names = parts[2].split(',') if len(parts) > 2 else []
        field_names = [name.strip() for name in field_names if name.strip()]
        
        template = EnhancedStructTemplate(format_str, field_names)
        self.converters[restype] = template
    
    def convert_resource_fork_to_json(self, data: bytes) -> str:
        """Convert resource fork to JSON with structured parsing."""
        # Use original rsrcdump to get basic structure
        # Suppress the print output from rsrcdump.save_to_json
        import io
        import contextlib
        
        f = io.StringIO()
        with contextlib.redirect_stdout(f):
            basic_json_str = rsrcdump.save_to_json(data)
            
        basic_data = json.loads(basic_json_str)
        
        # Enhance with structured parsing
        enhanced_data = self._enhance_with_structured_parsing(basic_data)
        
        return json.dumps(enhanced_data, indent=2)
    
    def _enhance_with_structured_parsing(self, basic_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance basic data with structured parsing using otto specs."""
        enhanced = {}
        
        for key, value in basic_data.items():
            if key == '_metadata':
                enhanced[key] = value
                continue
                
            if isinstance(value, dict) and key in self.converters:
                # This is a resource type that we have specs for
                template = self.converters[key]
                enhanced[key] = self._convert_resource_type(value, template)
            else:
                # No converter, keep as-is
                enhanced[key] = value
                
        return enhanced
    
    def _convert_resource_type(self, resource_data: Dict[str, Any], template: EnhancedStructTemplate) -> Dict[str, Any]:
        """Convert a resource type using the template."""
        result = {}
        
        for res_id, res_info in resource_data.items():
            converted_res = {}
            
            # Copy metadata (name, flags, etc.)
            for meta_key in ['name', 'flags', 'junk', 'order']:
                if meta_key in res_info:
                    converted_res[meta_key] = res_info[meta_key]
            
            # Parse the binary data if it exists
            if 'data' in res_info:
                try:
                    # Convert hex string back to bytes
                    hex_data = res_info['data']
                    binary_data = bytes.fromhex(hex_data)
                    
                    if template.is_list:
                        # Parse as list of records
                        records = []
                        num_records = len(binary_data) // template.record_length
                        
                        for i in range(num_records):
                            offset = i * template.record_length
                            record = template.unpack_data(binary_data, offset)
                            records.append(record)
                            
                        converted_res['obj'] = records
                    else:
                        # Parse as single record
                        converted_res['obj'] = template.unpack_data(binary_data)
                        
                except Exception as e:
                    # Fall back to original data on parse error
                    converted_res['data'] = res_info['data']
                    converted_res['conversionError'] = str(e)
            else:
                # No data field, copy as-is
                for key, val in res_info.items():
                    converted_res[key] = val
            
            result[res_id] = converted_res
            
        return result


def main():
    """Main function for enhanced rsrcdump."""
    if len(sys.argv) < 2:
        print("Usage: enhanced_rsrcdump.py <resource_fork_file> [otto_specs_file]")
        sys.exit(1)
    
    resource_file = sys.argv[1]
    otto_specs_file = sys.argv[2] if len(sys.argv) > 2 else 'otto-specs.txt'
    
    if not os.path.exists(resource_file):
        print(f"Error: Resource file not found: {resource_file}")
        sys.exit(1)
        
    if not os.path.exists(otto_specs_file):
        print(f"Error: Otto specs file not found: {otto_specs_file}")
        sys.exit(1)
    
    try:
        converter = OttoSpecsConverter(otto_specs_file)
        
        with open(resource_file, 'rb') as f:
            data = f.read()
            
        json_output = converter.convert_resource_fork_to_json(data)
        print(json_output)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()