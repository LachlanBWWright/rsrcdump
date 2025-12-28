/**
 * Example: Using camelCase conversion
 */

import {
  snakeToCamel,
  camelToSnake,
  objectKeysToCamel,
  objectKeysToSnake
} from '../dist/index.js';

console.log('=== CamelCase Conversion Examples ===\n');

// Example 1: Simple string conversion
console.log('1. String Conversion:');
console.log('   snake_case → camelCase:', snakeToCamel('hello_world'));
console.log('   snake_case → camelCase:', snakeToCamel('my_variable_name'));
console.log('   camelCase → snake_case:', camelToSnake('helloWorld'));
console.log('   camelCase → snake_case:', camelToSnake('myVariableName'));
console.log('');

// Example 2: Object keys conversion
console.log('2. Object Keys Conversion (snake_case → camelCase):');
const snakeCaseObject = {
  first_name: 'John',
  last_name: 'Doe',
  age_in_years: 30,
  contact_info: {
    phone_number: '123-456-7890',
    email_address: 'john@example.com'
  }
};

console.log('   Input:', JSON.stringify(snakeCaseObject, null, 2));
const camelCaseObject = objectKeysToCamel(snakeCaseObject);
console.log('   Output:', JSON.stringify(camelCaseObject, null, 2));
console.log('');

// Example 3: Resource fork metadata conversion
console.log('3. Resource Fork Metadata:');
const snakeCaseMetadata = {
  _metadata: {
    junk1: 0,
    junk2: 0,
    file_attributes: 0
  },
  'PICT': {
    '128': {
      name: 'Background',
      conversion_error: 'Not implemented'
    }
  }
};

console.log('   Input (snake_case):');
console.log('   ' + JSON.stringify(snakeCaseMetadata, null, 2).split('\n').join('\n   '));

const camelCaseMetadata = objectKeysToCamel(snakeCaseMetadata);
console.log('   Output (camelCase):');
console.log('   ' + JSON.stringify(camelCaseMetadata, null, 2).split('\n').join('\n   '));
console.log('');

// Example 4: Arrays of objects
console.log('4. Arrays of Objects:');
const users = {
  user_list: [
    { first_name: 'Alice', last_name: 'Smith', is_active: true },
    { first_name: 'Bob', last_name: 'Jones', is_active: false }
  ]
};

console.log('   Input:', JSON.stringify(users, null, 2));
const camelUsers = objectKeysToCamel(users);
console.log('   Output:', JSON.stringify(camelUsers, null, 2));
console.log('');

// Example 5: Converting back to snake_case
console.log('5. Round-trip Conversion:');
const original = { user_name: 'test', user_id: 123 };
const toCamel = objectKeysToCamel(original);
const backToSnake = objectKeysToSnake(toCamel);

console.log('   Original:', JSON.stringify(original));
console.log('   To camelCase:', JSON.stringify(toCamel));
console.log('   Back to snake_case:', JSON.stringify(backToSnake));
console.log('   Match:', JSON.stringify(original) === JSON.stringify(backToSnake) ? '✓' : '✗');
console.log('');

console.log('✓ CamelCase conversion makes TypeScript code more idiomatic!');
console.log('✓ Snake_case still supported for compatibility with Python version');
