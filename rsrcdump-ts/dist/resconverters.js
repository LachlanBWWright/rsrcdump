/**
 * Resource converters for different resource types
 */
import { unpackRecord, pack } from './structtemplate.js';
import { ok, err } from './result.js';
/**
 * Base16 (hex) converter for raw data
 */
export class Base16Converter {
    separateFile = '';
    jsonKey = 'data';
    unpack(res, _fork) {
        return ok(Buffer.from(res.data).toString('hex').toUpperCase());
    }
    pack(obj) {
        if (typeof obj !== 'string') {
            return err('Expected string for base16 data');
        }
        try {
            return ok(new Uint8Array(Buffer.from(obj, 'hex')));
        }
        catch (e) {
            return err(`Failed to decode hex: ${e}`);
        }
    }
}
/**
 * Struct-based converter using struct templates
 */
export class StructConverter {
    separateFile = '';
    jsonKey = 'obj';
    template;
    constructor(template) {
        this.template = template;
    }
    unpack(res, _fork) {
        const template = this.template;
        if (template.isList) {
            const resObject = [];
            if (res.data.length % template.recordLength !== 0) {
                return err(`The length of resource (${res.data.length} bytes) ` +
                    `isn't a multiple of the struct format (${template.recordLength} bytes)`);
            }
            for (let i = 0; i < res.data.length / template.recordLength; i++) {
                const recordResult = unpackRecord(template, res.data, i * template.recordLength);
                if (!recordResult.ok) {
                    return recordResult;
                }
                resObject.push(recordResult.value);
            }
            return ok(resObject);
        }
        else {
            if (res.data.length !== template.recordLength) {
                return err(`The length of resource (${res.data.length} bytes) ` +
                    `doesn't match the struct format (${template.recordLength} bytes)`);
            }
            return unpackRecord(template, res.data, 0);
        }
    }
    pack(obj) {
        return pack(this.template, obj);
    }
}
/**
 * Single string converter for STR resources
 */
export class SingleStringConverter {
    separateFile = '';
    jsonKey = 'obj';
    unpack(res, _fork) {
        if (res.data.length === 0) {
            return ok('');
        }
        const length = res.data[0];
        const text = res.data.slice(1, 1 + length);
        // Simplified encoding - use latin1 for macroman approximation
        return ok(Buffer.from(text).toString('latin1'));
    }
    pack(obj) {
        if (typeof obj !== 'string') {
            return err('Expected string');
        }
        const encoded = Buffer.from(obj, 'latin1');
        const length = Math.min(encoded.length, 255);
        const result = new Uint8Array(1 + length);
        result[0] = length;
        result.set(encoded.slice(0, length), 1);
        return ok(result);
    }
}
/**
 * String list converter for STR# resources
 */
export class StringListConverter {
    separateFile = '';
    jsonKey = 'obj';
    unpack(res, _fork) {
        if (res.data.length < 2) {
            return ok([]);
        }
        const view = new DataView(res.data.buffer, res.data.byteOffset);
        const count = view.getUint16(0, false); // big-endian
        const strings = [];
        let offset = 2;
        for (let i = 0; i < count; i++) {
            if (offset >= res.data.length) {
                break;
            }
            const length = res.data[offset];
            offset++;
            if (offset + length > res.data.length) {
                break;
            }
            const text = res.data.slice(offset, offset + length);
            strings.push(Buffer.from(text).toString('latin1'));
            offset += length;
        }
        return ok(strings);
    }
    pack(obj) {
        if (!Array.isArray(obj)) {
            return err('Expected array of strings');
        }
        const buffers = [];
        const countBuffer = new Uint8Array(2);
        const view = new DataView(countBuffer.buffer);
        view.setUint16(0, obj.length, false);
        buffers.push(countBuffer);
        for (const str of obj) {
            if (typeof str !== 'string') {
                return err('Expected string in array');
            }
            const encoded = Buffer.from(str, 'latin1');
            const length = Math.min(encoded.length, 255);
            const strBuffer = new Uint8Array(1 + length);
            strBuffer[0] = length;
            strBuffer.set(encoded.slice(0, length), 1);
            buffers.push(strBuffer);
        }
        const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const buf of buffers) {
            result.set(buf, offset);
            offset += buf.length;
        }
        return ok(result);
    }
}
/**
 * TEXT resource converter
 */
export class TextConverter {
    separateFile = '';
    jsonKey = 'obj';
    unpack(res, _fork) {
        return ok(Buffer.from(res.data).toString('latin1'));
    }
    pack(obj) {
        if (typeof obj !== 'string') {
            return err('Expected string');
        }
        return ok(new Uint8Array(Buffer.from(obj, 'latin1')));
    }
}
/**
 * Standard converters for common resource types
 */
export function getStandardConverters() {
    const converters = new Map();
    // Add standard text converters
    const strKey = Buffer.from('STR ', 'binary').toString('binary');
    converters.set(strKey, new SingleStringConverter());
    const strListKey = Buffer.from('STR#', 'binary').toString('binary');
    converters.set(strListKey, new StringListConverter());
    const textKey = Buffer.from('TEXT', 'binary').toString('binary');
    converters.set(textKey, new TextConverter());
    return converters;
}
//# sourceMappingURL=resconverters.js.map