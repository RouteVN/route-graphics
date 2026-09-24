import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const containerSchemaPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../src/schemas/elements/container.element.yaml",
);

describe("container element schema", () => {
  it("accepts text-revealing children without explicit coordinates", async () => {
    const schema = yaml.load(await readFile(containerSchemaPath, "utf8"));
    const childSchemas = schema.properties.children.items.oneOf;

    expect(childSchemas.map(({ $ref }) => $ref)).toContain(
      "./text-revealing.element.yaml",
    );
    expect(schema.required).not.toContain("x");
    expect(schema.required).not.toContain("y");
  });
});
