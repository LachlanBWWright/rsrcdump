/**
 * Command-line interface for rsrcdump-ts
 */

import { readFile, writeFile } from 'fs/promises';
import { load, saveToJson, loadBytesFromJsonAsync } from './index.js';
import { isOk } from './result.js';
import { resourceForkToString } from './resfork.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  npm run cli extract <input.rsrc> <output.json> [struct-file]');
    console.log('  npm run cli create <input.json> <output.rsrc>');
    console.log('  npm run cli list <input.rsrc>');
    return;
  }

  const command = args[0];

  if (command === 'extract') {
    const inputPath = args[1];
    const outputPath = args[2];
    const structFile = args[3];

    if (!inputPath || !outputPath) {
      console.error('Usage: npm run cli extract <input.rsrc> <output.json> [struct-file]');
      process.exit(1);
    }

    console.log(`Extracting ${inputPath}...`);

    try {
      const data = await readFile(inputPath);
      
      let structSpecs: string[] = [];
      if (structFile) {
        const structContent = await readFile(structFile, 'utf-8');
        structSpecs = structContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
      }

      const jsonResult = await saveToJson(new Uint8Array(data), structSpecs);

      if (!isOk(jsonResult)) {
        console.error('Error:', jsonResult.error);
        process.exit(1);
      }

      await writeFile(outputPath, jsonResult.value);
      console.log(`Wrote ${outputPath}`);
    } catch (e) {
      console.error('Error:', e);
      process.exit(1);
    }
  } else if (command === 'create') {
    const inputPath = args[1];
    const outputPath = args[2];
    const structFile = args[3];

    if (!inputPath || !outputPath) {
      console.error('Usage: npm run cli create <input.json> <output.rsrc> [struct-file]');
      process.exit(1);
    }

    console.log(`Creating ${outputPath} from ${inputPath}...`);

    try {
      const jsonContent = await readFile(inputPath, 'utf-8');
      const jsonBlob = JSON.parse(jsonContent);

      let structSpecs: string[] = [];
      if (structFile) {
        const structContent = await readFile(structFile, 'utf-8');
        structSpecs = structContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
      }

      const bytesResult = await loadBytesFromJsonAsync(jsonBlob, structSpecs);

      if (!isOk(bytesResult)) {
        console.error('Error:', bytesResult.error);
        process.exit(1);
      }

      await writeFile(outputPath, bytesResult.value);
      console.log(`Wrote ${outputPath}`);
    } catch (e) {
      console.error('Error:', e);
      process.exit(1);
    }
  } else if (command === 'list') {
    const inputPath = args[1];

    if (!inputPath) {
      console.error('Usage: npm run cli list <input.rsrc>');
      process.exit(1);
    }

    try {
      const result = await load(inputPath);

      if (!isOk(result)) {
        console.error('Error:', result.error);
        process.exit(1);
      }

      const fork = result.value;
      console.log(resourceForkToString(fork));
      console.log();
      console.log(`${'Type'.padEnd(4)} ${'ID'.padStart(6)} ${'Size'.padStart(8)}  Name`);
      console.log(`${'-'.repeat(4)} ${'-'.repeat(6)} ${'-'.repeat(8)}  ${'-'.repeat(32)}`);

      for (const [typeKey, typeMap] of fork.tree) {
        for (const [resId, res] of typeMap) {
          const typeStr = Buffer.from(typeKey, 'binary').toString('latin1');
          const nameStr = Buffer.from(res.name).toString('latin1');
          console.log(
            `${typeStr.padEnd(4)} ${resId.toString().padStart(6)} ${res.data.length.toString().padStart(8)}  ${nameStr}`
          );
        }
      }
    } catch (e) {
      console.error('Error:', e);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch(console.error);
