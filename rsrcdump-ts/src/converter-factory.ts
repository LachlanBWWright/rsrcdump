import { bytesToBinary } from "./buffer-utils.js";
import {
  getStandardConverters,
  StructConverter,
  type ResourceConverter,
} from "./resconverters.js";
import { isOk } from "./result.js";
import {
  structTemplateFromString,
  structTemplateFromStringWithTypename,
} from "./structtemplate.js";
import { parseTypeName } from "./textio.js";

export async function getConverters(
  structSpecs: string[],
): Promise<Map<string, ResourceConverter>> {
  const converters = getStandardConverters();

  for (const templateArg of structSpecs) {
    const result = await structTemplateFromStringWithTypename(templateArg);
    if (!isOk(result)) continue;

    const { converter, restype } = result.value;
    converters.set(bytesToBinary(restype), new StructConverter(converter));
  }

  return converters;
}

export function getConvertersSync(
  structSpecs: string[],
): Map<string, ResourceConverter> {
  const converters = getStandardConverters();

  for (const templateArg of structSpecs) {
    addSyncConverter(converters, templateArg);
  }

  return converters;
}

function addSyncConverter(
  converters: Map<string, ResourceConverter>,
  templateArg: string,
): void {
  try {
    const trimmed = templateArg.trim();
    if (!trimmed || trimmed.startsWith("//")) return;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) return;

    const resourceType = trimmed.slice(0, colonIndex);
    const format = trimmed.slice(colonIndex + 1);
    if (!resourceType || !format) return;

    const templateResult = structTemplateFromString(format);
    if (!templateResult.ok) {
      console.warn(
        `Skipping invalid struct spec: ${templateArg} -> ${templateResult.error}`,
      );
      return;
    }

    const typeKey = bytesToBinary(parseTypeName(resourceType));
    converters.set(typeKey, new StructConverter(templateResult.value));
  } catch (error) {
    console.warn(`Failed to parse struct spec '${templateArg}': ${error}`);
  }
}
