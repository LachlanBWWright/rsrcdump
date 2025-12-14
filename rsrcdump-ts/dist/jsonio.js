/**
 * JSON I/O for resource forks
 */
import { resourceNameStr, createResource, createResourceFork, } from './resfork.js';
import { Base16Converter } from './resconverters.js';
import { decode, encode, parseTypeName } from './textio.js';
import { ok, err } from './result.js';
/**
 * Converts a resource fork to JSON
 */
export function resourceForkToJson(fork, includeTypes = [], excludeTypes = [], converters, metadata = {}) {
    const jsonBlob = {
        _metadata: {
            junk1: fork.junkNextresmap,
            junk2: fork.junkFilerefnum,
            file_attributes: fork.fileAttributes,
            ...metadata,
        },
    };
    const includeTypeKeys = new Set(includeTypes.map(t => Buffer.from(t).toString('binary')));
    const excludeTypeKeys = new Set(excludeTypes.map(t => Buffer.from(t).toString('binary')));
    for (const [typeKey, typeMap] of fork.tree) {
        if (excludeTypeKeys.has(typeKey)) {
            continue;
        }
        if (includeTypeKeys.size > 0 && !includeTypeKeys.has(typeKey)) {
            continue;
        }
        const resType = Buffer.from(typeKey, 'binary');
        const resTypeKey = decode(new Uint8Array(resType), 'replace');
        const typeObj = {};
        const converter = converters.get(typeKey) || new Base16Converter();
        for (const [resId, res] of typeMap) {
            const wrapper = {};
            if (res.name.length > 0) {
                wrapper.name = resourceNameStr(res);
            }
            if (res.flags !== 0) {
                wrapper.flags = res.flags;
            }
            if (res.junk !== 0) {
                wrapper.junk = res.junk;
            }
            if (res.order !== 0xFFFFFFFF) {
                wrapper.order = res.order;
            }
            const unpackResult = converter.unpack(res, fork);
            if (!unpackResult.ok) {
                wrapper.conversion_error = unpackResult.error;
                // Fall back to base16
                const base16Result = new Base16Converter().unpack(res, fork);
                if (base16Result.ok) {
                    wrapper.data = base16Result.value;
                }
            }
            else {
                wrapper[converter.jsonKey] = unpackResult.value;
            }
            typeObj[resId.toString()] = wrapper;
        }
        jsonBlob[resTypeKey] = typeObj;
    }
    return ok(jsonBlob);
}
/**
 * Converts JSON to a resource fork
 */
export function jsonToResourceFork(jsonBlob, converters, onlyTypes = [], skipTypes = []) {
    const fork = createResourceFork();
    const metadata = jsonBlob._metadata;
    if (!metadata) {
        return err('Missing _metadata in JSON');
    }
    fork.fileAttributes = metadata.file_attributes;
    fork.junkNextresmap = metadata.junk1;
    fork.junkFilerefnum = metadata.junk2;
    const onlyTypeKeys = new Set(onlyTypes.map(t => Buffer.from(t).toString('binary')));
    const skipTypeKeys = new Set(skipTypes.map(t => Buffer.from(t).toString('binary')));
    for (const [typeName, typeRecords] of Object.entries(jsonBlob)) {
        if (typeName.startsWith('_')) {
            continue; // Skip metadata
        }
        if (typeName.length > 4) {
            continue; // Probably not a resource type
        }
        const resType = parseTypeName(typeName);
        const typeKey = Buffer.from(resType).toString('binary');
        if (skipTypeKeys.has(typeKey)) {
            continue;
        }
        if (onlyTypeKeys.size > 0 && !onlyTypeKeys.has(typeKey)) {
            continue;
        }
        const typeMap = new Map();
        fork.tree.set(typeKey, typeMap);
        const converter = converters.get(typeKey) || new Base16Converter();
        if (typeof typeRecords !== 'object' || typeRecords === null) {
            return err(`Type ${typeName} is not an object`);
        }
        for (const [resIdStr, resBlob] of Object.entries(typeRecords)) {
            if (typeof resBlob !== 'object' || resBlob === null) {
                return err(`Resource ${typeName} #${resIdStr} is not an object`);
            }
            const wrapper = resBlob;
            const resNum = parseInt(resIdStr, 10);
            const resName = encode(wrapper.name || '', 'replace');
            const resFlags = wrapper.flags || 0;
            const resJunk = wrapper.junk || 0;
            const resOrder = wrapper.order !== undefined ? wrapper.order : -1;
            const dataBlob = wrapper[converter.jsonKey];
            const packResult = converter.pack(dataBlob);
            if (!packResult.ok) {
                return err(`Failed to pack ${typeName} #${resIdStr}: ${packResult.error}`);
            }
            const res = createResource(resType, resNum, packResult.value, resName, resFlags, resJunk, resOrder);
            typeMap.set(resNum, res);
        }
    }
    return ok(fork);
}
/**
 * Converts a resource fork to a JSON string
 */
export function resourceForkToJsonString(fork, includeTypes = [], excludeTypes = [], converters, metadata = {}) {
    const jsonResult = resourceForkToJson(fork, includeTypes, excludeTypes, converters, metadata);
    if (!jsonResult.ok) {
        return jsonResult;
    }
    try {
        return ok(JSON.stringify(jsonResult.value, null, '\t'));
    }
    catch (e) {
        return err(`Failed to stringify JSON: ${e}`);
    }
}
/**
 * Parses a JSON string to a resource fork
 */
export function jsonStringToResourceFork(jsonString, converters, onlyTypes = [], skipTypes = []) {
    let jsonBlob;
    try {
        jsonBlob = JSON.parse(jsonString);
    }
    catch (e) {
        return err(`Failed to parse JSON: ${e}`);
    }
    return jsonToResourceFork(jsonBlob, converters, onlyTypes, skipTypes);
}
//# sourceMappingURL=jsonio.js.map