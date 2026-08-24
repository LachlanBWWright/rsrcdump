from os import PathLike
from typing import List

from rsrcdump.__main__ import adf_resource_fork_to_bytes, resource_fork_to_bytes
from rsrcdump.textio import parse_type_name
from rsrcdump.resfork import ResourceFork
from rsrcdump.adf import unpack_adf, ADF_ENTRYNUM_RESOURCEFORK, NotADFError
from rsrcdump.jsonio import json_to_resource_fork
from rsrcdump.resconverters import standard_converters, StructConverter
from rsrcdump.default_specs import DEFAULT_STRUCT_SPECS
from rsrcdump.adf import unpack_adf, ADF_ENTRYNUM_RESOURCEFORK, NotADFError
from rsrcdump.jsonio import resource_fork_to_json, json_to_resource_fork
from rsrcdump.resconverters import standard_converters, StructConverter


def load(data_or_path: bytes | PathLike) -> ResourceFork:
    if type(data_or_path) is not bytes:
        path = data_or_path
        with open(path, 'rb') as f:
            data = f.read()
    else:
        data: bytes = data_or_path

    try:
        adf_entries = unpack_adf(data)
        adf_resfork = adf_entries[ADF_ENTRYNUM_RESOURCEFORK]
        fork = ResourceFork.from_bytes(adf_resfork)
    except NotADFError:
        fork = ResourceFork.from_bytes(data)
    return fork

def save_to_json(
        bytes: bytes, #The bytes to be parsed
        struct_specs: list[str] = [],
        include_types: list[str] = [], #Only include resources of these types (All if empty)
        exclude_types: list[str] = [], #Skip resources of these types
        use_default_specs: bool = True,
):
    try:
        adf_entries = unpack_adf(bytes)
        adf_resfork = adf_entries[ADF_ENTRYNUM_RESOURCEFORK]
        fork = ResourceFork.from_bytes(adf_resfork)
    except NotADFError:
        fork = ResourceFork.from_bytes(bytes)

    return resource_fork_to_json(
        fork,
        [parse_type_name(x) for x in include_types],
        [parse_type_name(x) for x in exclude_types],
        _get_converters(struct_specs, use_default_specs),
        {} #TODO: Metadata not implemented
    )



def load_bytes_from_json(
        json_blob: dict,
        struct_specs: list[str] = [],
        only_types: list[str] = [],
        skip_types: list[str] = [],
        adf: bool = True,
):
    fork = json_to_resource_fork(
        json_blob,
        _get_converters(struct_specs, use_default_specs=True),
        [parse_type_name(x) for x in only_types],
        [parse_type_name(x) for x in skip_types],
    )

    if adf:
        return adf_resource_fork_to_bytes(fork, json_blob)
    return resource_fork_to_bytes(fork)



def _get_converters(struct_specs: List[str], use_default_specs: bool = True):
    converters = {}
    templates = [*DEFAULT_STRUCT_SPECS, *struct_specs] if use_default_specs else struct_specs
    for template_arg in templates:
        converter, restype = StructConverter.from_template_string_with_typename(template_arg)
        if converter and restype:
            converters[restype] = converter

    # Specialized converters are more expressive than a generic template.
    # User templates are applied last and remain the final authority.
    converters.update(standard_converters)
    for template_arg in struct_specs:
        converter, restype = StructConverter.from_template_string_with_typename(template_arg)
        if converter and restype:
            converters[restype] = converter

    return converters
