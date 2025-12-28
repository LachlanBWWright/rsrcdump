/**
 * TypeScript type generation from struct specs
 */

import { StructTemplate, structTemplateFromString } from './structtemplate.js';
import { Result, ok, err, isOk } from './result.js';
import { snakeToCamel } from './caseutils.js';

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
  typeName: string,
  useCamelCase: boolean = true
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
      const finalName = useCamelCase ? snakeToCamel(fieldName) : fieldName;
      fields.push(`  ${finalName}: ${tsType};`);
    }
  }
  
  return `export interface ${typeName} {\n${fields.join('\n')}\n}`;
}

/**
 * Generates TypeScript type definition from struct template
 */
export function generateTypeFromTemplate(
  template: StructTemplate,
  typeName: string,
  useCamelCase: boolean = true
): string {
  const recordType = generateRecordType(template, `${typeName}Record`, useCamelCase);
  
  if (template.isList) {
    return `${recordType}\n\nexport type ${typeName} = ${typeName}Record[];`;
  }
  
  return recordType.replace(`${typeName}Record`, typeName);
}

/**
 * Generates TypeScript type definitions for all struct specs
 */
export function generateTypesFromSpecs(
  specs: Map<string, string>,
  useCamelCase: boolean = true
): Result<string, string> {
  const typeDefs: string[] = [];
  
  typeDefs.push('/**');
  typeDefs.push(' * Auto-generated TypeScript types from struct specs');
  typeDefs.push(' * @generated');
  typeDefs.push(' */');
  typeDefs.push('');
  
  for (const [resourceType, specString] of specs) {
    const templateResult = structTemplateFromString(specString);
    
    if (!isOk(templateResult)) {
      return err(`Failed to parse spec for ${resourceType}: ${templateResult.error}`);
    }
    
    const template = templateResult.value;
    const typeName = resourceType.replace(/[^a-zA-Z0-9]/g, '_');
    
    const typeDef = generateTypeFromTemplate(template, typeName, useCamelCase);
    typeDefs.push(typeDef);
    typeDefs.push('');
  }
  
  // Add resource wrapper types
  typeDefs.push('/**');
  typeDefs.push(' * Wrapper for resource with metadata');
  typeDefs.push(' */');
  typeDefs.push('export interface ResourceWrapper<T> {');
  if (useCamelCase) {
    typeDefs.push('  name?: string;');
    typeDefs.push('  flags?: number;');
    typeDefs.push('  junk?: number;');
    typeDefs.push('  order?: number;');
    typeDefs.push('  obj?: T;');
    typeDefs.push('  data?: string;');
    typeDefs.push('  conversionError?: string;');
  } else {
    typeDefs.push('  name?: string;');
    typeDefs.push('  flags?: number;');
    typeDefs.push('  junk?: number;');
    typeDefs.push('  order?: number;');
    typeDefs.push('  obj?: T;');
    typeDefs.push('  data?: string;');
    typeDefs.push('  conversion_error?: string;');
  }
  typeDefs.push('}');
  typeDefs.push('');
  
  // Add metadata type
  typeDefs.push('/**');
  typeDefs.push(' * Resource fork metadata');
  typeDefs.push(' */');
  typeDefs.push('export interface ResourceForkMetadata {');
  if (useCamelCase) {
    typeDefs.push('  junk1: number;');
    typeDefs.push('  junk2: number;');
    typeDefs.push('  fileAttributes: number;');
  } else {
    typeDefs.push('  junk1: number;');
    typeDefs.push('  junk2: number;');
    typeDefs.push('  file_attributes: number;');
  }
  typeDefs.push('  [key: string]: unknown;');
  typeDefs.push('}');
  typeDefs.push('');
  
  // Add root type
  typeDefs.push('/**');
  typeDefs.push(' * Root resource fork JSON structure');
  typeDefs.push(' */');
  typeDefs.push('export interface ResourceForkJson {');
  if (useCamelCase) {
    typeDefs.push('  _metadata: ResourceForkMetadata;');
  } else {
    typeDefs.push('  _metadata: ResourceForkMetadata;');
  }
  typeDefs.push('  [resourceType: string]: unknown;');
  typeDefs.push('}');
  
  return ok(typeDefs.join('\n'));
}

/**
 * Writes generated types to a file
 */
export async function writeGeneratedTypes(
  specs: Map<string, string>,
  outputPath: string,
  useCamelCase: boolean = true
): Promise<Result<void, string>> {
  const typesResult = generateTypesFromSpecs(specs, useCamelCase);
  
  if (!isOk(typesResult)) {
    return typesResult;
  }
  
  try {
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, typesResult.value, 'utf-8');
    return ok(undefined);
  } catch (e) {
    return err(`Failed to write types: ${e}`);
  }
}
