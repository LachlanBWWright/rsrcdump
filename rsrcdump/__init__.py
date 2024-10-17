from os import PathLike
from typing import List

from rsrcdump.textio import parse_type_name
from rsrcdump.resfork import ResourceFork
from rsrcdump.adf import unpack_adf, ADF_ENTRYNUM_RESOURCEFORK, NotADFError
from rsrcdump.jsonio import json_to_resource_fork
from rsrcdump.resconverters import standard_converters, StructConverter
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
):
    return resource_fork_to_json(
        ResourceFork.from_bytes(bytes),
        [parse_type_name(x) for x in include_types],
        [parse_type_name(x) for x in exclude_types],
        _get_converters(struct_specs),
        {} #TODO: Metadata not implemented
    )



def load_from_json(
        json_blob: dict,
        struct_specs: list[str] = [],
        only_types: list[str] = [],
        skip_types: list[str] = []
):
    return json_to_resource_fork(
        json_blob,
        _get_converters(struct_specs),
        [parse_type_name(x) for x in only_types],
        [parse_type_name(x) for x in skip_types],
    )

def _get_converters(struct_specs: List[str]):
    converters = standard_converters.copy()
    for template_arg in struct_specs:
        converter, restype = StructConverter.from_template_string_with_typename(template_arg)
        if converter and restype:
            converters[restype] = converter
    return converters