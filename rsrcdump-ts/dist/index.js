/**
 * rsrcdump-ts public API
 * TypeScript port of rsrcdump with Result/Err error handling
 */
import { readFile } from 'fs/promises';
import { resourceForkFromBytes, packResourceFork, } from './resfork.js';
import { unpackAdf, packAdf, ADF_ENTRYNUM_RESOURCEFORK } from './adf.js';
import { resourceForkToJsonString, jsonToResourceFork, } from './jsonio.js';
import { getStandardConverters, StructConverter } from './resconverters.js';
import { structTemplateFromStringWithTypename, } from './structtemplate.js';
import { parseTypeName } from './textio.js';
import { ok, err, isOk } from './result.js';
export { ok, err, isOk, isErr, unwrap, map, andThen } from './result.js';
export { resourceForkFromBytes, packResourceFork, createResource, createResourceFork, resourceDesc, resourceTypeStr, resourceNameStr, orderedFlatList, getResourceType, resourceForkToString, } from './resfork.js';
export { unpackAdf, packAdf, ADF_MAGIC, ADF_VERSION, ADF_ENTRYNUM_RESOURCEFORK, } from './adf.js';
export { resourceForkToJsonString, jsonToResourceFork, } from './jsonio.js';
export { getStandardConverters, Base16Converter, StructConverter, SingleStringConverter, StringListConverter, TextConverter, } from './resconverters.js';
export { structTemplateFromString, structTemplateFromStringWithTypename, unpackRecord, pack as packStruct, } from './structtemplate.js';
export { getGlobalEncoding, setGlobalEncoding, sanitizeTypeName, parseTypeName, sanitizeResourceName, decode, encode, } from './textio.js';
/**
 * Loads a resource fork from a file path or bytes
 */
export async function load(pathOrData) {
    let data;
    if (typeof pathOrData === 'string') {
        try {
            const buffer = await readFile(pathOrData);
            data = new Uint8Array(buffer);
        }
        catch (e) {
            return err(`Failed to read file: ${e}`);
        }
    }
    else {
        data = pathOrData;
    }
    // Try to unpack as ADF first
    const adfResult = unpackAdf(data);
    if (isOk(adfResult)) {
        const entries = adfResult.value;
        const resforkData = entries.get(ADF_ENTRYNUM_RESOURCEFORK);
        if (resforkData) {
            return resourceForkFromBytes(resforkData);
        }
    }
    // Fall back to raw resource fork
    return resourceForkFromBytes(data);
}
/**
 * Saves a resource fork to JSON
 */
export async function saveToJson(data, structSpecs = [], includeTypes = [], excludeTypes = []) {
    const loadResult = await load(data);
    if (!loadResult.ok) {
        return loadResult;
    }
    const fork = loadResult.value;
    const converters = await getConverters(structSpecs);
    const includeTypeBytes = includeTypes.map(t => parseTypeName(t));
    const excludeTypeBytes = excludeTypes.map(t => parseTypeName(t));
    return resourceForkToJsonString(fork, includeTypeBytes, excludeTypeBytes, converters);
}
/**
 * Loads bytes from JSON
 */
export function loadBytesFromJson(jsonBlob, structSpecs = [], onlyTypes = [], skipTypes = [], adf = true) {
    const converters = getConvertersSync(structSpecs);
    const onlyTypeBytes = onlyTypes.map(t => parseTypeName(t));
    const skipTypeBytes = skipTypes.map(t => parseTypeName(t));
    const forkResult = jsonToResourceFork(jsonBlob, converters, onlyTypeBytes, skipTypeBytes);
    if (!forkResult.ok) {
        return forkResult;
    }
    const fork = forkResult.value;
    const packResult = packResourceFork(fork);
    if (!packResult.ok) {
        return packResult;
    }
    const binaryFork = packResult.value;
    if (adf) {
        const adfEntries = new Map();
        adfEntries.set(ADF_ENTRYNUM_RESOURCEFORK, binaryFork);
        return packAdf(adfEntries);
    }
    return ok(binaryFork);
}
/**
 * Gets converters with custom struct specs
 */
async function getConverters(structSpecs) {
    const converters = getStandardConverters();
    for (const templateArg of structSpecs) {
        const result = await structTemplateFromStringWithTypename(templateArg);
        if (isOk(result)) {
            const { converter, restype } = result.value;
            const typeKey = Buffer.from(restype).toString('binary');
            converters.set(typeKey, new StructConverter(converter));
        }
    }
    return converters;
}
/**
 * Gets converters synchronously
 */
function getConvertersSync(_structSpecs) {
    const converters = getStandardConverters();
    // For now, skip struct specs in sync version
    // A full implementation would need to handle this properly
    return converters;
}
//# sourceMappingURL=index.js.map