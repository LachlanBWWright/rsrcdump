// Struct template parsing for binary data formats

import type { StructTemplate } from './types.js';

export class StructTemplateParser {
  static fromTemplateString(template: string): StructTemplate {
    const split = template.split(':', 3);
    
    const formatStr = split.shift()!;
    const fieldNames = split.length > 0 ? split.shift()!.split(',') : [];
    
    if (!formatStr) {
      throw new Error('Empty format string');
    }
    
    return new StructTemplateParser(formatStr, fieldNames).build();
  }

  private formatStr: string;
  private fieldNames: string[];
  private isList: boolean = false;
  private recordLength: number = 0;

  constructor(formatStr: string, fieldNames: string[]) {
    this.formatStr = formatStr;
    this.fieldNames = fieldNames;
    
    // Handle list indicator
    if (this.formatStr.endsWith('+')) {
      this.isList = true;
      this.formatStr = this.formatStr.slice(0, -1);
    }
    
    // Add endianness if not specified (default to big-endian)
    if (!this.formatStr.match(/^[!@=<>]/)) {
      this.formatStr = '>' + this.formatStr;
    }
  }

  build(): StructTemplate {
    const fieldFormats = this.splitStructFormatFields(this.formatStr);
    this.recordLength = this.calculateRecordLength(fieldFormats);
    
    return {
      format: this.formatStr,
      fieldNames: this.expandFieldNames(fieldFormats),
      isList: this.isList,
      recordLength: this.recordLength
    };
  }

  private splitStructFormatFields(fmt: string): string[] {
    const fields: string[] = [];
    let repeat = 0;
    
    for (let i = 0; i < fmt.length; i++) {
      const c = fmt[i];
      
      // Ignore redundant values
      if (/\s/.test(c) || '@!><'.includes(c)) {
        continue;
      }
      
      // Calculate repeat count
      if (/\d/.test(c)) {
        repeat = repeat * 10 + parseInt(c);
        continue;
      }
      
      // Handle format characters
      if (/[CB?HILFQD]/.test(c.toUpperCase()) || c === 'x') {
        for (let j = 0; j < Math.max(repeat || 1, 1); j++) {
          fields.push(c);
        }
        repeat = 0;
      } else if (c === 's') {
        fields.push(`${Math.max(repeat || 1, 1)}${c}`);
        repeat = 0;
      } else {
        throw new Error(`Unsupported struct format character '${c}'`);
      }
    }
    
    return fields;
  }

  private calculateRecordLength(fields: string[]): number {
    let length = 0;
    
    for (const field of fields) {
      switch (field) {
        case 'B': // unsigned char
        case 'b': // signed char
        case 'c': // char
        case 'x': // pad byte
        case '?': // bool
          length += 1;
          break;
        case 'H': // unsigned short
        case 'h': // signed short
          length += 2;
          break;
        case 'I': // unsigned int
        case 'i': // signed int
        case 'L': // unsigned long
        case 'l': // signed long
        case 'f': // float
          length += 4;
          break;
        case 'Q': // unsigned long long
        case 'q': // signed long long  
        case 'd': // double
          length += 8;
          break;
        default:
          if (field.endsWith('s')) {
            // String field like "4s"
            const num = parseInt(field.slice(0, -1));
            length += num;
          } else {
            throw new Error(`Unknown field type: ${field}`);
          }
      }
    }
    
    return length;
  }

  private expandFieldNames(fields: string[]): (string | null)[] {
    const result: (string | null)[] = [];
    let fieldNameIndex = 0;
    
    for (let i = 0; i < fields.length; i++) {
      if (fieldNameIndex < this.fieldNames.length) {
        const name = this.fieldNames[fieldNameIndex];
        result.push(name || null);
        fieldNameIndex++;
      } else {
        result.push(null);
      }
    }
    
    return result;
  }

  static unpackRecord(data: Uint8Array, offset: number, template: StructTemplate): any {
    const view = new DataView(data.buffer, data.byteOffset + offset);
    const values: any[] = [];
    let pos = 0;

    const fields = this.splitStructFormatFields(template.format);
    
    for (const field of fields) {
      switch (field) {
        case 'B': // unsigned char
          values.push(view.getUint8(pos));
          pos += 1;
          break;
        case 'b': // signed char
          values.push(view.getInt8(pos));
          pos += 1;
          break;
        case 'H': // unsigned short (big-endian)
          values.push(view.getUint16(pos, false));
          pos += 2;
          break;
        case 'h': // signed short (big-endian)
          values.push(view.getInt16(pos, false));
          pos += 2;
          break;
        case 'I': // unsigned int (big-endian)
        case 'L': // unsigned long (big-endian)
          values.push(view.getUint32(pos, false));
          pos += 4;
          break;
        case 'i': // signed int (big-endian)
        case 'l': // signed long (big-endian)
          values.push(view.getInt32(pos, false));
          pos += 4;
          break;
        case 'f': // float (big-endian)
          values.push(view.getFloat32(pos, false));
          pos += 4;
          break;
        case 'Q': // unsigned long long (big-endian)
          values.push(view.getBigUint64(pos, false));
          pos += 8;
          break;
        case 'q': // signed long long (big-endian)
          values.push(view.getBigInt64(pos, false));
          pos += 8;
          break;
        case 'd': // double (big-endian)
          values.push(view.getFloat64(pos, false));
          pos += 8;
          break;
        case 'x': // pad byte
        case '?': // bool (treat as byte for now)
          values.push(view.getUint8(pos));
          pos += 1;
          break;
        default:
          if (field.endsWith('s')) {
            // String field
            const num = parseInt(field.slice(0, -1));
            const bytes = new Uint8Array(data.buffer, data.byteOffset + offset + pos, num);
            values.push(new TextDecoder('utf-8').decode(bytes));
            pos += num;
          } else {
            throw new Error(`Unknown field type: ${field}`);
          }
      }
    }

    return this.tagValues(values, template);
  }

  private static splitStructFormatFields(fmt: string): string[] {
    // Remove endianness prefix for field parsing
    const cleanFmt = fmt.replace(/^[!@=<>]/, '');
    const fields: string[] = [];
    let repeat = 0;
    
    for (let i = 0; i < cleanFmt.length; i++) {
      const c = cleanFmt[i];
      
      // Ignore whitespace
      if (/\s/.test(c)) {
        continue;
      }
      
      // Calculate repeat count
      if (/\d/.test(c)) {
        repeat = repeat * 10 + parseInt(c);
        continue;
      }
      
      // Handle format characters
      if (/[CB?HILFQD]/.test(c.toUpperCase()) || c === 'x') {
        for (let j = 0; j < Math.max(repeat || 1, 1); j++) {
          fields.push(c);
        }
        repeat = 0;
      } else if (c === 's') {
        fields.push(`${Math.max(repeat || 1, 1)}${c}`);
        repeat = 0;
      }
    }
    
    return fields;
  }

  private static tagValues(values: any[], template: StructTemplate): any {
    if (template.fieldNames.length === 1 && !template.fieldNames[0]) {
      // Scalar value
      return values[0];
    }
    
    const result: any = {};
    
    for (let i = 0; i < values.length; i++) {
      const fieldName = template.fieldNames[i] || `.field${i}`;
      result[fieldName] = values[i];
    }
    
    return result;
  }
}