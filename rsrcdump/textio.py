from urllib.parse import quote_from_bytes, unquote_to_bytes

GLOBAL_ENCODING = 'macroman'


def get_global_encoding() -> str:
    return GLOBAL_ENCODING


def set_global_encoding(encoding: str):
    global GLOBAL_ENCODING
    GLOBAL_ENCODING = encoding


def sanitize_type_name(restype: bytes) -> str:
    if len(restype) != 4:
        raise ValueError(f"restype isn't 4 bytes")
    assert len(restype) == 4
    if restype != b'    ':
        restype = restype.rstrip(b' ')
    return quote_from_bytes(restype, safe=b"")


def parse_type_name(sane_name: str) -> bytes:
    restype = unquote_to_bytes(sane_name)
    restype = restype.ljust(4, b' ')
    if len(restype) != 4:
        raise ValueError(f"decoded restype doesn't work out to 4 bytes")
    return restype


def sanitize_resource_name(name: str | bytes) -> str:
    sanitized = ""
    for c in name:
        if str(c) in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-':
            sanitized += str(c)
    return sanitized
