

from rsrcdump.resfork import InvalidResourceFork, ResourceFork
from rsrcdump.adf import unpack_adf, ADF_ENTRYNUM_RESOURCEFORK, pack_adf, NotADFError
from rsrcdump.jsonio import resource_fork_to_json, json_to_resource_fork
from rsrcdump.textio import set_global_encoding, parse_type_name
from rsrcdump.resconverters import ResourceConverter, standard_converters, StructConverter, Base16Converter
from typing import Any


def save_to_json(
        bytes: bytes, #The bytes to be parsed
        struct_specs: list[str] = [],
        include_types: list[bytes] = [], #Only include resources of these types (All if empty)
        exclude_types: list[bytes] = [], #Skip resources of these types
):
    fork = ResourceFork.from_bytes(bytes)

    converters = standard_converters.copy()
    for template_arg in struct_specs:
        converter, restype = StructConverter.from_template_string_with_typename(template_arg)
        if converter and restype:
            converters[restype] = converter


    res_code = resource_fork_to_json(
        fork,
        include_types,
        exclude_types,
        converters,
        {} #TODO: Metadata not implemented
    )
    return res_code


def load_from_json(
        json_blob: dict,
        converters: dict[bytes, ResourceConverter],
        only_types: list[bytes] = [],
        skip_types: list[bytes] = []
):
    return json_to_resource_fork(
        json_blob,
        converters,
        only_types,
        skip_types
    )