# Pangea resource corpus

Run from `rsrcdump-ts/`:

```sh
pnpm install --frozen-lockfile
pnpm test:pangea
```

The default data source is the sibling checkout
`../../../../PangeaRSEdit/games/pangea-ports/games` relative to this directory.
To use another checkout, point to the directory containing the game ports:

```sh
PANGEA_GAMES_ROOT=/absolute/path/to/pangea-ports/games pnpm test:pangea
```

Data must already be present. Missing directories fail collection rather than
silently skipping coverage. Tests only read the assets; they do not download,
copy, change, or redistribute game data. `pnpm test:run` remains independent of
the external corpus.

The corpus includes every `.rsrc` file in `Data/Terrain` and `Data/Skeletons`
for Otto Matic, Bugdom, Bugdom 2, Nanosaur, Nanosaur 2, Cro-Mag Rally, and
Billy Frontier. Mighty Mike uses other native formats and is outside this
resource-fork suite. Nanosaur's terrain is also a different format; its skeleton
resources are covered.

Assertions check resource type/ID inventories, names, flags, metadata and exact
payload lengths/SHA-256 hashes through binary and hex JSON round trips. Buffer
subarray tests exercise nonzero byte offsets and trailing bytes. Liquid tests
exercise the actual game's structured records, coordinate edits, and rejection
of missing coordinates. They assert preservation rather than merely logging
differences. Byte-for-byte equality of the entire resource-fork container is not
required because serialization can repack its offsets and padding.

This checkout's `master` has an older API than the editor's published
`@lachlanbwwright/rsrcdump-ts@1.0.6`. These tests import the local implementation,
not the editor's installed package. The initial corpus run exposes structured
liquid packing corruption and silent acceptance of missing coordinates. These
are ordinary failing assertions, not skipped tests or expected failures; fixing
the serializer is separate work. No library behavior is changed by this suite.

The new JSON layout API is verified separately with `pnpm test:pangea:json`.
That command includes the raw preservation tests and structured JSON layout
tests, while leaving the legacy string-converter failures visible in
`pnpm test:pangea`. See [JSON-LAYOUTS.md](../../JSON-LAYOUTS.md) for the API,
schemas, examples, and byte-preservation behavior.
