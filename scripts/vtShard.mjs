// Prints the rtgl `--item` selectors for one CI shard of the visual specs.
// Specs are dealt round-robin in path order, so each shard gets a slice of
// every folder and every spec lands in exactly one shard.
// Usage: node scripts/vtShard.mjs <shard-index> <shard-total>
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const specsDir = fileURLToPath(new URL("../vt/specs/", import.meta.url));
const [index, total] = process.argv.slice(2).map(Number);
if (
  !Number.isInteger(index) ||
  !Number.isInteger(total) ||
  index < 0 ||
  index >= total
) {
  throw new Error(
    "Usage: node scripts/vtShard.mjs <shard-index> <shard-total>",
  );
}

const specs = readdirSync(specsDir, { recursive: true })
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) =>
    file
      .replace(/\.ya?ml$/, "")
      .split(path.sep)
      .join("/"),
  )
  .sort();

// CI passes the output unquoted, so a space would split one selector in two.
const spaced = specs.find((spec) => /\s/.test(spec));
if (spaced) {
  throw new Error(`VT spec paths must not contain whitespace: ${spaced}`);
}

console.log(
  specs
    .filter((_, specIndex) => specIndex % total === index)
    .map((spec) => `--item ${spec}`)
    .join(" "),
);
