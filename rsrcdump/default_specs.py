"""Conservative built-in templates for well-known classic Mac resources.

These are compiled resource layouts, not Rez source declarations.  They are
intentionally limited to fixed-size layouts that can be validated from the
resource length; variable-length resources continue to use their specialised
converters or raw data.

Reference: Inside Macintosh: Macintosh Toolbox Essentials, Finder Interface
and Event Manager resource descriptions (https://dev.os9.ca/techpubs/mac/).
"""

DEFAULT_STRUCT_SPECS = [
    "FREF:4sHB:fileType,localID,emptyString",
    "RECT:hhhh:top,left,bottom,right",
    "SIZE:HII:flags,minimumPartitionSize,preferredPartitionSize",
    "MBAR:h+:menuID",
]

# Indexed by More Macintosh Toolbox. These formats are variable or
# application-defined, so a byte-list keeps them inspectable without claiming
# a false fixed layout. Specialised converters still take precedence.
KNOWN_VARIABLE_RESOURCE_TYPES = [
    "cdev", "DITL", "FKEY",
    "icm#", "icm4",
    "INIT", "LDEF", "mntr", "movv", "PACK",
]

DEFAULT_STRUCT_SPECS.extend(
    f"{restype}:B+:bytes" for restype in KNOWN_VARIABLE_RESOURCE_TYPES
)
