/**
 * Conservative compiled layouts for well-known classic Mac resources.
 * Variable-length resources deliberately remain on their specialised
 * converters or raw-data path.
 *
 * Reference: Inside Macintosh: Macintosh Toolbox Essentials,
 * https://dev.os9.ca/techpubs/mac/
 */
export const defaultStructSpecs = [
  "FREF:4sHB:fileType,localID,emptyString",
  "RECT:hhhh:top,left,bottom,right",
  "SIZE:HII:flags,minimumPartitionSize,preferredPartitionSize",
  "MBAR:h+:menuID",
  "cdev:B+:bytes",
  "DITL:B+:bytes",
  "FKEY:B+:bytes",
  "INIT:B+:bytes",
  "LDEF:B+:bytes",
  "mntr:B+:bytes",
  "movv:B+:bytes",
  "PACK:B+:bytes",
] as const;
