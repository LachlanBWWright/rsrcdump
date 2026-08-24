// Resource converters for different resource types

import type { Resource, ResourceFork, ResourceConverter, StructTemplate } from './types.js';
import { StructTemplateParser } from './structtemplate.js';

export class Base16Converter implements ResourceConverter {
  unpack(resource: Resource, _fork?: ResourceFork): string {
    return Array.from(resource.data)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  pack(obj: string): Uint8Array {
    if (typeof obj !== 'string') {
      throw new Error('Expected string for base16 data');
    }
    
    const result = new Uint8Array(obj.length / 2);
    for (let i = 0; i < obj.length; i += 2) {
      result[i / 2] = parseInt(obj.substr(i, 2), 16);
    }
    return result;
  }
}

export class StructConverter implements ResourceConverter {
  private template: StructTemplate;

  static fromTemplateStringWithTypename(templateArg: string): [StructConverter | null, Uint8Array | null] {
    const trimmed = templateArg.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      return [null, null];
    }

    const split = trimmed.split(':', 3);
    if (split.length < 2) {
      throw new Error('Invalid template format');
    }

    const restype = parseTypeName(split[0]);
    const formatAndFields = split.slice(1).join(':'); // Rejoin format and fields
    const template = StructTemplateParser.fromTemplateString(formatAndFields);
    
    return [new StructConverter(template), restype];
  }

  constructor(template: StructTemplate) {
    this.template = template;
  }

  unpack(resource: Resource, _fork?: ResourceFork): any {
    if (this.template.isList) {
      const result: any[] = [];
      
      if (resource.data.length % this.template.recordLength !== 0) {
        throw new Error(
          `The length of ${resource.type} ${resource.id} (${resource.data.length} bytes) ` +
          `isn't a multiple of the struct format for this resource type ` +
          `(${this.template.recordLength} bytes)`
        );
      }

      const numRecords = resource.data.length / this.template.recordLength;
      for (let i = 0; i < numRecords; i++) {
        const record = StructTemplateParser.unpackRecord(
          resource.data, 
          i * this.template.recordLength, 
          this.template
        );
        result.push(record);
      }
      return result;
    } else {
      if (resource.data.length !== this.template.recordLength) {
        throw new Error(
          `The length of ${resource.type} ${resource.id} (${resource.data.length} bytes) ` +
          `doesn't match the struct format for this resource type ` +
          `(${this.template.recordLength} bytes)`
        );
      }

      return StructTemplateParser.unpackRecord(resource.data, 0, this.template);
    }
  }

  pack(obj: any): Uint8Array {
    if (this.template.isList) {
      if (!Array.isArray(obj)) {
        throw new Error('Expected array for list struct');
      }
      
      const result = new Uint8Array(obj.length * this.template.recordLength);
      for (let i = 0; i < obj.length; i++) {
        const record = this.packRecord(obj[i], this.template);
        result.set(record, i * this.template.recordLength);
      }
      return result;
    } else {
      return this.packRecord(obj, this.template);
    }
  }

  private packRecord(obj: any, template: StructTemplate): Uint8Array {
    const result = new Uint8Array(template.recordLength);
    const view = new DataView(result.buffer);
    const fields = StructTemplateParser.splitStructFormatFields(template.format);
    
    let pos = 0;
    let fieldIndex = 0;

    for (const field of fields) {
      let value: any;
      
      if (fieldIndex < template.fieldNames.length) {
        const fieldName = template.fieldNames[fieldIndex];
        if (fieldName !== null) {
          value = obj[fieldName];
        }
      }
      
      switch (field) {
        case 'B': // unsigned char
          view.setUint8(pos, value || 0);
          pos += 1;
          break;
        case 'b': // signed char
          view.setInt8(pos, value || 0);
          pos += 1;
          break;
        case 'H': // unsigned short (big-endian)
          view.setUint16(pos, value || 0, false);
          pos += 2;
          break;
        case 'h': // signed short (big-endian)
          view.setInt16(pos, value || 0, false);
          pos += 2;
          break;
        case 'I': // unsigned int (big-endian)
        case 'L': // unsigned long (big-endian)
          view.setUint32(pos, value || 0, false);
          pos += 4;
          break;
        case 'i': // signed int (big-endian)
        case 'l': // signed long (big-endian)
          view.setInt32(pos, value || 0, false);
          pos += 4;
          break;
        case 'f': // float (big-endian)
          view.setFloat32(pos, value || 0.0, false);
          pos += 4;
          break;
        case 'Q': // unsigned long long (big-endian)
          view.setBigUint64(pos, BigInt(value || 0), false);
          pos += 8;
          break;
        case 'q': // signed long long (big-endian)
          view.setBigInt64(pos, BigInt(value || 0), false);
          pos += 8;
          break;
        case 'd': // double (big-endian)
          view.setFloat64(pos, value || 0.0, false);
          pos += 8;
          break;
        case 'x': // pad byte
          view.setUint8(pos, 0); // Write padding as zero
          pos += 1;
          break;
        case '?': // bool
          view.setUint8(pos, value ? 1 : 0);
          pos += 1;
          break;
        default:
          if (field.endsWith('s')) {
            // String field
            const num = parseInt(field.slice(0, -1));
            const str = (value || '').toString();
            const encoded = new TextEncoder().encode(str);
            const toCopy = Math.min(encoded.length, num);
            result.set(encoded.slice(0, toCopy), pos);
            pos += num;
          } else {
            throw new Error(`Unknown field type: ${field}`);
          }
      }
      
      // Only increment field index for non-padding fields
      if (field !== 'x') {
        fieldIndex++;
      }
    }
    
    return result;
  }
}

class PascalStringConverter implements ResourceConverter {
  unpack(resource: Resource): string {
    const length = resource.data[0] ?? 0;
    return new TextDecoder().decode(resource.data.slice(1, 1 + length));
  }
  pack(value: any): Uint8Array {
    const data = new TextEncoder().encode(String(value));
    if (data.length > 255) throw new Error('Pascal strings cannot exceed 255 bytes');
    return new Uint8Array([data.length, ...data]);
  }
}

class TextConverter implements ResourceConverter {
  unpack(resource: Resource): string {
    return new TextDecoder().decode(resource.data);
  }
  pack(value: any): Uint8Array {
    return new TextEncoder().encode(String(value));
  }
}

class StringListConverter implements ResourceConverter {
  unpack(resource: Resource): string[] {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const count = view.getUint16(0, false);
    const strings: string[] = [];
    let offset = 2;
    for (let index = 0; index < count; index++) {
      const length = resource.data[offset] ?? 0;
      strings.push(new TextDecoder().decode(resource.data.slice(offset + 1, offset + 1 + length)));
      offset += 1 + length;
    }
    if (offset !== resource.data.length) throw new Error(`Unexpected trailing bytes in ${resource.type} #${resource.id}`);
    return strings;
  }
  pack(value: any): Uint8Array {
    if (!Array.isArray(value)) throw new Error('STR# must be an array of strings');
    const encoded = value.map((entry) => new TextEncoder().encode(String(entry)));
    if (encoded.some((entry) => entry.length > 255)) throw new Error('STR# strings cannot exceed 255 bytes');
    const result = new Uint8Array(2 + encoded.reduce((total, entry) => total + 1 + entry.length, 0));
    const view = new DataView(result.buffer);
    view.setUint16(0, encoded.length, false);
    let offset = 2;
    for (const entry of encoded) { result[offset++] = entry.length; result.set(entry, offset); offset += entry.length; }
    return result;
  }
}

class FileReferenceConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const length = resource.data[6] ?? 0;
    return {
      fileType: new TextDecoder().decode(resource.data.slice(0, 4)),
      localID: view.getUint16(4, false),
      name: new TextDecoder().decode(resource.data.slice(7, 7 + length)),
    };
  }
}

class RectanglePositionsConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const count = view.getUint16(0, false);
    const rectangles = [];
    let offset = 2;
    for (let i = 0; i < count; i++) {
      rectangles.push({
        top: view.getInt16(offset, false), left: view.getInt16(offset + 2, false),
        bottom: view.getInt16(offset + 4, false), right: view.getInt16(offset + 6, false),
      });
      offset += 8;
    }
    if (offset !== resource.data.length) throw new Error(`Unexpected trailing bytes in ${resource.type} #${resource.id}`);
    return { count, rectangles };
  }
}

class BundleConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const text = (offset: number) => new TextDecoder().decode(resource.data.slice(offset, offset + 4));
    let offset = 0;
    const signature = text(offset); offset += 4;
    const signatureResourceID = view.getUint16(offset, false); offset += 2;
    const typeCount = view.getUint16(offset, false) + 1; offset += 2;
    const mappings = [];
    for (let i = 0; i < typeCount; i++) {
      const resourceType = text(offset); offset += 4;
      const pairCount = view.getUint16(offset, false) + 1; offset += 2;
      const items = [];
      for (let j = 0; j < pairCount; j++) {
        items.push({ localID: view.getUint16(offset, false), resourceID: view.getUint16(offset + 2, false) });
        offset += 4;
      }
      mappings.push({ resourceType, items });
    }
    if (offset !== resource.data.length) throw new Error(`Unexpected trailing bytes in ${resource.type} #${resource.id}`);
    return { signature, signatureResourceID, mappings };
  }
}

class OpenResourceConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const signature = new TextDecoder().decode(resource.data.slice(0, 4));
    const fileTypes = [];
    for (let offset = 4; offset + 4 <= resource.data.length; offset += 4) {
      fileTypes.push(new TextDecoder().decode(resource.data.slice(offset, offset + 4)));
    }
    return { signature, fileTypes };
  }
}

class KindResourceConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const decoder = new TextDecoder();
    const signature = decoder.decode(resource.data.slice(0, 4));
    const localization = view.getUint16(4, false);
    const entries = [];
    let offset = 6;
    while (offset + 5 <= resource.data.length) {
      const fileType = decoder.decode(resource.data.slice(offset, offset + 4));
      const length = resource.data[offset + 4] ?? 0;
      entries.push({ fileType, kind: decoder.decode(resource.data.slice(offset + 5, offset + 5 + length)) });
      offset += 5 + length;
    }
    return { signature, localization, entries };
  }
}

class DialogItemListConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const names: Record<number, string> = { 0: 'userItem', 4: 'button', 5: 'checkbox', 6: 'radioButton', 7: 'control', 8: 'staticText', 16: 'editableText', 32: 'icon', 64: 'picture' };
    const count = view.getUint16(0, false);
    const items = [];
    let offset = 2;
    for (let index = 0; index <= count; index++) {
      const bounds = { top: view.getInt16(offset, false), left: view.getInt16(offset + 2, false), bottom: view.getInt16(offset + 4, false), right: view.getInt16(offset + 6, false) };
      const itemType = resource.data[offset + 8] ?? 0;
      const kind = itemType & 0x7f;
      const item: any = { index: index + 1, bounds, type: names[kind] ?? `unknown(${kind})`, enabled: !(itemType & 0x80) };
      offset += 9;
      if ([4, 5, 6, 8, 16].includes(kind)) {
        const length = resource.data[offset] ?? 0;
        item.text = new TextDecoder().decode(resource.data.slice(offset + 1, offset + 1 + length));
        offset += 1 + length;
      } else if ([7, 32, 64].includes(kind)) {
        item.resourceID = view.getUint16(offset, false);
        offset += 2;
      }
      if (offset % 2) offset++;
      items.push(item);
    }
    return items;
  }
}

class ComponentResourceConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const decoder = new TextDecoder();
    let offset = 0;
    const fourCC = () => { const value = decoder.decode(resource.data.slice(offset, offset + 4)); offset += 4; return value; };
    const resourceSpec = () => { const type = fourCC(); const id = view.getInt16(offset, false); offset += 2; return { type, id }; };
    const description = { type: fourCC(), subtype: fourCC(), manufacturer: fourCC(), flags: view.getUint32(offset, false), flagsMask: view.getUint32(offset + 4, false) };
    offset += 8;
    return { description, component: resourceSpec(), name: resourceSpec(), info: resourceSpec(), icon: resourceSpec() };
  }
}

class ColorTableConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const seed = view.getUint32(0, false);
    const flags = view.getInt16(4, false);
    const count = view.getUint16(6, false) + 1;
    const entries = [];
    let offset = 8;
    for (let index = 0; index < count; index++) {
      entries.push({ value: view.getUint16(offset, false), red: view.getUint16(offset + 2, false), green: view.getUint16(offset + 4, false), blue: view.getUint16(offset + 6, false) });
      offset += 8;
    }
    if (offset !== resource.data.length) throw new Error(`Unexpected trailing bytes in ${resource.type} #${resource.id}`);
    return { seed, flags, entries };
  }
}

class HelpResourceConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    if (resource.data.length < 8) throw new Error(`Short Help Manager resource ${resource.type} #${resource.id}`);
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const header = { version: view.getInt16(0, false), options: view.getInt16(2, false), balloonDefinitionID: view.getInt16(4, false), variation: view.getInt16(6, false) };
    const components = [];
    let offset = 8;
    while (offset + 2 <= resource.data.length) {
      const size = view.getUint16(offset, false); offset += 2;
      const payload = resource.data.slice(offset, offset + size); offset += size;
      components.push({ size, data: Array.from(payload).map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase() });
    }
    if (offset !== resource.data.length) throw new Error(`Invalid Help Manager component length in ${resource.type} #${resource.id}`);
    return { header, components };
  }
}

class StyledTextConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const styleCount = view.getInt16(0, false);
    const styles = [];
    let offset = 2;
    for (let index = 0; index < styleCount; index++) {
      styles.push({ startChar: view.getInt32(offset, false), height: view.getInt16(offset + 4, false), ascent: view.getInt16(offset + 6, false), font: view.getInt16(offset + 8, false), face: view.getUint8(offset + 10), size: view.getInt16(offset + 12, false), color: { red: view.getUint16(offset + 14, false), green: view.getUint16(offset + 16, false), blue: view.getUint16(offset + 18, false) } });
      offset += 20;
    }
    if (offset !== resource.data.length) throw new Error(`Unexpected trailing bytes in ${resource.type} #${resource.id}`);
    return { styleCount, styles };
  }
}

class RomOverrideConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const romVersion = view.getUint16(0, false);
    const resourceCount = view.getUint16(2, false);
    const overrides = [];
    let offset = 4;
    for (let index = 0; index < resourceCount; index++) {
      overrides.push({
        resourceType: text(resource.data.slice(offset, offset + 4)),
        resourceID: view.getInt16(offset + 4, false),
      });
      offset += 6;
    }
    if (offset !== resource.data.length) throw new Error(`Unexpected trailing bytes in ${resource.type} #${resource.id}`);
    return { romVersion, resourceCount, overrides };
  }
}

class MiniIconConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const width = 12, height = 16;
    const expected = resource.type === 'icm#' ? 64 : resource.type === 'icm4' ? 96 : 192;
    if (resource.data.length !== expected) throw new Error(`Invalid ${resource.type} length`);
    return {
      width,
      height,
      format: resource.type === 'icm#' ? '1-bit image and mask' : resource.type === 'icm4' ? '4-bit indexed pixels' : '8-bit indexed pixels',
      data: Array.from(resource.data).map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase(),
    };
  }
}

class GammaTableConverter implements ResourceConverter {
  unpack(resource: Resource): any {
    const view = new DataView(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
    const version = view.getInt16(0, false), type = view.getInt16(2, false), formulaSize = view.getInt16(4, false);
    const channels = view.getInt16(6, false), dataCount = view.getInt16(8, false), dataWidth = view.getInt16(10, false);
    const formulaData = resource.data.slice(12, 12 + formulaSize);
    const bytesPerSample = Math.max(1, Math.ceil(dataWidth / 8));
    const samples = [];
    let offset = 12 + formulaSize;
    for (let index = 0; index < channels * dataCount; index++) {
      let value = 0;
      for (let byte = 0; byte < bytesPerSample; byte++) value = value * 256 + (resource.data[offset + byte] ?? 0);
      samples.push(value); offset += bytesPerSample;
    }
    if (offset !== resource.data.length) throw new Error(`Unexpected trailing bytes in ${resource.type} #${resource.id}`);
    return { version, type, formulaSize, channels, dataCount, dataWidth, formulaData: Array.from(formulaData).map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase(), samples };
  }
}

// Helper function to parse type names (moved from textio to avoid circular imports)
function parseTypeName(saneName: string): Uint8Array {
  const decoded = new TextEncoder().encode(decodeURIComponent(saneName));
  const result = new Uint8Array(4);
  result.fill(0x20); // space character
  
  for (let i = 0; i < Math.min(decoded.length, 4); i++) {
    result[i] = decoded[i];
  }
  
  if (decoded.length > 4) {
    throw new Error(`decoded restype doesn't work out to 4 bytes`);
  }
  
  return result;
}

export const standardConverters: Map<string, ResourceConverter> = new Map([
  ['BNDL', new BundleConverter()], ['FREF', new FileReferenceConverter()],
  ['card', new PascalStringConverter()], ['nrct', new RectanglePositionsConverter()],
  ['finf', StructConverter.fromTemplateStringWithTypename('finf:hhh:fontID,fontStyle,fontSize')[0]!],
  ['mach', StructConverter.fromTemplateStringWithTypename('mach:HH:hardwareMask,softwareMask')[0]!],
  ['open', new OpenResourceConverter()], ['kind', new KindResourceConverter()],
  ['DITL', new DialogItemListConverter()],
  ['thng', new ComponentResourceConverter()],
  ['dctb', new ColorTableConverter()], ['ictb', new ColorTableConverter()],
  ['hdlg', new HelpResourceConverter()], ['hfdr', new HelpResourceConverter()], ['hmnu', new HelpResourceConverter()],
  ['hovr', new HelpResourceConverter()], ['hrct', new HelpResourceConverter()], ['hwin', new HelpResourceConverter()],
  ['styl', new StyledTextConverter()],
  ['gama', new GammaTableConverter()],
  ['ROv#', new RomOverrideConverter()],
  ['icm#', new MiniIconConverter()], ['icm4', new MiniIconConverter()], ['icm8', new MiniIconConverter()],
]);
