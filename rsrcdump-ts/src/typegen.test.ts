/**
 * Tests for TypeScript type generation from struct specs
 */

import { describe, it, expect } from 'vitest';
import { generateTypesFromSpecs, generateTypeFromTemplate } from './typegen';
import { structTemplateFromString } from './structtemplate';
import { isOk } from './result';

describe('typegen', () => {
  describe('generateTypeFromTemplate', () => {
    it('generates interface for simple struct', () => {
      const templateResult = structTemplateFromString('>HH:x,y');
      expect(isOk(templateResult)).toBe(true);
      
      if (!isOk(templateResult)) return;
      
      const typeStr = generateTypeFromTemplate(templateResult.value, 'Point');
      expect(typeStr).toContain('export interface Point');
      expect(typeStr).toContain('x: number');
      expect(typeStr).toContain('y: number');
    });

    it('generates array type for list structs', () => {
      const templateResult = structTemplateFromString('>HH+:x,y');
      expect(isOk(templateResult)).toBe(true);
      
      if (!isOk(templateResult)) return;
      
      const typeStr = generateTypeFromTemplate(templateResult.value, 'Points');
      expect(typeStr).toContain('export interface PointsRecord');
      expect(typeStr).toContain('export type Points = PointsRecord[]');
    });

    it('generates type for scalar structs', () => {
      const templateResult = structTemplateFromString('>f+');
      expect(isOk(templateResult)).toBe(true);
      
      if (!isOk(templateResult)) return;
      
      const typeStr = generateTypeFromTemplate(templateResult.value, 'YCrd');
      // Scalar list generates Record type + array
      expect(typeStr).toContain('export type YCrdRecord = number');
      expect(typeStr).toContain('export type YCrd = YCrdRecord[]');
    });

    it('handles unnamed fields', () => {
      const templateResult = structTemplateFromString('>HHH:x,,z');
      expect(isOk(templateResult)).toBe(true);
      
      if (!isOk(templateResult)) return;
      
      const typeStr = generateTypeFromTemplate(templateResult.value, 'Partial');
      expect(typeStr).toContain('x: number');
      expect(typeStr).toContain('.field1: number'); // Note: no quotes in actual output
      expect(typeStr).toContain('z: number');
    });

    it('preserves field names with underscores', () => {
      const templateResult = structTemplateFromString('>HH:x_pos,y_pos');
      expect(isOk(templateResult)).toBe(true);
      
      if (!isOk(templateResult)) return;
      
      const typeStr = generateTypeFromTemplate(templateResult.value, 'Point');
      expect(typeStr).toContain('x_pos: number');
      expect(typeStr).toContain('y_pos: number');
    });
  });

  describe('generateTypesFromSpecs', () => {
    it('generates types for multiple specs', () => {
      const specs = new Map<string, string>([
        ['Hedr', '>LHH:version,width,height'],
        ['Itms', '>HH+:x,y']
      ]);

      const result = generateTypesFromSpecs(specs);
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const typeStr = result.value;
      expect(typeStr).toContain('export interface Hedr');
      expect(typeStr).toContain('version: number');
      expect(typeStr).toContain('export type Itms = ItmsRecord[]');
    });

    it('includes ResourceWrapper and metadata types', () => {
      const specs = new Map<string, string>([
        ['Test', '>H:value']
      ]);

      const result = generateTypesFromSpecs(specs);
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const typeStr = result.value;
      expect(typeStr).toContain('export interface ResourceWrapper<T>');
      expect(typeStr).toContain('export interface ResourceForkMetadata');
      expect(typeStr).toContain('export interface ResourceForkJson');
    });

    it('uses snake_case for metadata fields', () => {
      const specs = new Map<string, string>();

      const result = generateTypesFromSpecs(specs);
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const typeStr = result.value;
      expect(typeStr).toContain('file_attributes: number');
      expect(typeStr).toContain('conversion_error?: string');
    });

    it('handles spec parsing errors', () => {
      const specs = new Map<string, string>([
        ['Bad', '>Z:bad'] // Invalid format character
      ]);

      const result = generateTypesFromSpecs(specs);
      expect(isOk(result)).toBe(false);
      if (isOk(result)) return;
      
      expect(result.error).toContain('Failed to parse spec for Bad');
    });
  });
});
