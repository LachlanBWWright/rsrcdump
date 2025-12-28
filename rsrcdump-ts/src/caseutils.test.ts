/**
 * Tests for case conversion utilities
 */

import { describe, it, expect } from 'vitest';
import { snakeToCamel, camelToSnake, objectKeysToCamel, objectKeysToSnake } from './caseutils';

describe('caseutils', () => {
  describe('snakeToCamel', () => {
    it('converts snake_case to camelCase', () => {
      expect(snakeToCamel('hello_world')).toBe('helloWorld');
      expect(snakeToCamel('my_variable_name')).toBe('myVariableName');
      expect(snakeToCamel('single')).toBe('single');
      expect(snakeToCamel('with_many_underscores')).toBe('withManyUnderscores');
    });

    it('handles edge cases', () => {
      expect(snakeToCamel('')).toBe('');
      expect(snakeToCamel('_leading')).toBe('Leading');
      expect(snakeToCamel('trailing_')).toBe('trailing_');
    });
  });

  describe('camelToSnake', () => {
    it('converts camelCase to snake_case', () => {
      expect(camelToSnake('helloWorld')).toBe('hello_world');
      expect(camelToSnake('myVariableName')).toBe('my_variable_name');
      expect(camelToSnake('single')).toBe('single');
      expect(camelToSnake('withManyCapitals')).toBe('with_many_capitals');
    });

    it('handles edge cases', () => {
      expect(camelToSnake('')).toBe('');
      expect(camelToSnake('Simple')).toBe('_simple');
    });
  });

  describe('objectKeysToCamel', () => {
    it('converts object keys from snake_case to camelCase', () => {
      const input = {
        first_name: 'John',
        last_name: 'Doe',
        age_in_years: 30
      };

      const expected = {
        firstName: 'John',
        lastName: 'Doe',
        ageInYears: 30
      };

      expect(objectKeysToCamel(input)).toEqual(expected);
    });

    it('handles nested objects', () => {
      const input = {
        user_data: {
          first_name: 'Jane',
          contact_info: {
            phone_number: '123-456-7890'
          }
        }
      };

      const expected = {
        userData: {
          firstName: 'Jane',
          contactInfo: {
            phoneNumber: '123-456-7890'
          }
        }
      };

      expect(objectKeysToCamel(input)).toEqual(expected);
    });

    it('handles arrays', () => {
      const input = {
        user_list: [
          { first_name: 'John', last_name: 'Doe' },
          { first_name: 'Jane', last_name: 'Smith' }
        ]
      };

      const expected = {
        userList: [
          { firstName: 'John', lastName: 'Doe' },
          { firstName: 'Jane', lastName: 'Smith' }
        ]
      };

      expect(objectKeysToCamel(input)).toEqual(expected);
    });

    it('handles null and undefined', () => {
      expect(objectKeysToCamel(null)).toBe(null);
      expect(objectKeysToCamel(undefined)).toBe(undefined);
    });

    it('handles primitive values', () => {
      expect(objectKeysToCamel(42)).toBe(42);
      expect(objectKeysToCamel('hello')).toBe('hello');
      expect(objectKeysToCamel(true)).toBe(true);
    });
  });

  describe('objectKeysToSnake', () => {
    it('converts object keys from camelCase to snake_case', () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        ageInYears: 30
      };

      const expected = {
        first_name: 'John',
        last_name: 'Doe',
        age_in_years: 30
      };

      expect(objectKeysToSnake(input)).toEqual(expected);
    });

    it('handles nested objects', () => {
      const input = {
        userData: {
          firstName: 'Jane',
          contactInfo: {
            phoneNumber: '123-456-7890'
          }
        }
      };

      const expected = {
        user_data: {
          first_name: 'Jane',
          contact_info: {
            phone_number: '123-456-7890'
          }
        }
      };

      expect(objectKeysToSnake(input)).toEqual(expected);
    });

    it('handles arrays', () => {
      const input = {
        userList: [
          { firstName: 'John', lastName: 'Doe' },
          { firstName: 'Jane', lastName: 'Smith' }
        ]
      };

      const expected = {
        user_list: [
          { first_name: 'John', last_name: 'Doe' },
          { first_name: 'Jane', last_name: 'Smith' }
        ]
      };

      expect(objectKeysToSnake(input)).toEqual(expected);
    });
  });
});
