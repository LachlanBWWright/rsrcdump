import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { ResourceFork } from "../../src/types.js";

export const dataRoot = process.env.PANGEA_GAMES_ROOT ?? path.resolve(
  import.meta.dirname, "../../../../PangeaRSEdit/games/pangea-ports/games",
);

const games = [
  "OttoMatic-Android", "Bugdom-android", "Bugdom2-Android", "Nanosaur-android",
  "Nanosaur2-Android", "CroMagRally-Android", "BillyFrontier-Android",
];

export function pangeaFixtures() {
  return games.flatMap((game) => ["Terrain", "Skeletons"].flatMap((kind) => {
    const folder = path.join(dataRoot, game, "Data", kind);
    return readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".rsrc"))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => ({ name: `${game}/${kind}/${entry.name}`, file: path.join(folder, entry.name) }));
  }));
}

export function fixtureBytes(file: string): Uint8Array {
  return Uint8Array.from(readFileSync(file));
}

export function resourceSnapshot(fork: ResourceFork) {
  return {
    fileAttributes: fork.fileAttributes ?? 0,
    junkNextresmap: fork.junkNextresmap ?? 0,
    junkFilerefnum: fork.junkFilerefnum ?? 0,
    resources: [...fork.resources].flatMap(([type, resources]) => [...resources].map(([id, resource]) => ({
      type, id, name: resource.name ?? "", flags: resource.flags ?? 0,
      junk: resource.junk ?? 0, size: resource.data.length,
      sha256: createHash("sha256").update(resource.data).digest("hex"),
    }))).sort((left, right) => left.type.localeCompare(right.type) || left.id - right.id),
  };
}
