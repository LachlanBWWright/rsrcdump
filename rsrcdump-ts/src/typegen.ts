/**
 * TypeScript type generation from struct specs
 */

import { StructTemplate, structTemplateFromString } from './structtemplate.js';
import { Result, ok, err, isOk } from './result.js';

/**
 * Maps struct format characters to TypeScript types
 */
function formatCharToTsType(formatChar: string): string {
  const upper = formatChar.toUpperCase();
  
  // Integer types
  if ('CBHILQ'.includes(upper)) {
    return 'number';
  }
  
  // Float types
  if ('FD'.includes(upper)) {
    return 'number';
  }
  
  // String types
  if (formatChar.endsWith('s')) {
    return 'string';
  }
  
  // Padding
  if (upper === 'X') {
    return 'never'; // Skip padding fields
  }
  
  return 'unknown';
}

/**
 * Generates TypeScript type definition for a single struct record
 */
function generateRecordType(
  template: StructTemplate,
  typeName: string
): string {
  if (template.isScalar) {
    // Scalar templates produce a single value
    const tsType = formatCharToTsType(template.fieldFormats[0] || 'unknown');
    return `export type ${typeName} = ${tsType};`;
  }

  const fields: string[] = [];
  
  for (let i = 0; i < template.fieldFormats.length; i++) {
    const format = template.fieldFormats[i];
    const fieldName = template.fieldNames[i];
    
    if (!format) continue;
    
    const tsType = formatCharToTsType(format);
    
    if (tsType === 'never') {
      continue; // Skip padding fields
    }
    
    if (!fieldName) {
      // Unnamed field
      fields.push(`  ".field${i}": ${tsType};`);
    } else {
      fields.push(`  ${fieldName}: ${tsType};`);
    }
  }
  
  return `export interface ${typeName} {\n${fields.join('\n')}\n}`;
}

/**
 * Generates TypeScript type definition from struct template
 */
export function generateTypeFromTemplate(
  template: StructTemplate,
  typeName: string
): string {
  const recordType = generateRecordType(template, `${typeName}Record`);
  
  if (template.isList) {
    return `${recordType}\n\nexport type ${typeName} = ${typeName}Record[];`;
  }
  
  return recordType.replace(`${typeName}Record`, typeName);
}

/**
 * Generates TypeScript type definitions for all struct specs
 */
export function generateTypesFromSpecs(
  specs: Map<string, string>
): Result<string, string> {
  const typeDefs: string[] = [];
  
  typeDefs.push('/**');
  typeDefs.push(' * Auto-generated TypeScript types from struct specs');
  typeDefs.push(' * @generated');
  typeDefs.push(' */');
  typeDefs.push('');
  
  for (const [resourceType, specString] of specs) {
    let templateResult;
    try {
      templateResult = structTemplateFromString(specString);
    } catch (e) {
      return err(`Failed to parse spec for ${resourceType}: ${e}`);
    }
    
    if (!isOk(templateResult)) {
      return err(`Failed to parse spec for ${resourceType}: ${templateResult.error}`);
    }
    
    const template = templateResult.value;
    const typeName = resourceType.replace(/[^a-zA-Z0-9]/g, '_');
    
    const typeDef = generateTypeFromTemplate(template, typeName);
    typeDefs.push(typeDef);
    typeDefs.push('');
  }
  
  // Add resource wrapper types
  typeDefs.push('/**');
  typeDefs.push(' * Wrapper for resource with metadata');
  typeDefs.push(' */');
  typeDefs.push('export interface ResourceWrapper<T> {');
  typeDefs.push('  name?: string;');
  typeDefs.push('  flags?: number;');
  typeDefs.push('  junk?: number;');
  typeDefs.push('  order?: number;');
  typeDefs.push('  obj?: T;');
  typeDefs.push('  data?: string;');
  typeDefs.push('  conversion_error?: string;');
  typeDefs.push('}');
  typeDefs.push('');
  
  // Add metadata type
  typeDefs.push('/**');
  typeDefs.push(' * Resource fork metadata');
  typeDefs.push(' */');
  typeDefs.push('export interface ResourceForkMetadata {');
  typeDefs.push('  junk1: number;');
  typeDefs.push('  junk2: number;');
  typeDefs.push('  file_attributes: number;');
  typeDefs.push('  [key: string]: unknown;');
  typeDefs.push('}');
  typeDefs.push('');
  
  // Add root type
  typeDefs.push('/**');
  typeDefs.push(' * Root resource fork JSON structure');
  typeDefs.push(' */');
  typeDefs.push('export interface ResourceForkJson {');
  typeDefs.push('  _metadata: ResourceForkMetadata;');
  typeDefs.push('  [resourceType: string]: unknown;');
  typeDefs.push('}');
  
  return ok(typeDefs.join('\n'));
}

// Note: writeGeneratedTypes() has been removed for browser compatibility.
// Use generateTypesFromSpecs() to get the generated types as a string,
// then save them yourself if needed.
