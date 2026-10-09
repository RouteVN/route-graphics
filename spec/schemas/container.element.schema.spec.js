import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv from "ajv";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { parseContainer } from "../../src/plugins/elements/container/parseContainer.js";
import { parseTextRevealing } from "../../src/plugins/elements/text-revealing/parseTextRevealing.js";

const readYaml = async (url) => yaml.load(await readFile(url, "utf8"));
const testDirectory = dirname(fileURLToPath(import.meta.url));
// Existing schemas use $def for reusable definitions. Let Ajv resolve those
// JSON pointers while accepting this annotation in the draft-07 documents.
const ajv = new Ajv({
  strict: false,
  allErrors: true,
  loadSchema: (uri) => readYaml(new URL(uri)),
});

const compileSchema = async (filename) => {
  const url = pathToFileURL(
    resolve(testDirectory, "../../src/schemas/elements", filename),
  );
  return ajv.compileAsync({ ...(await readYaml(url)), $id: url.href });
};

const validateInput = await compileSchema("container.element.yaml");
const validateComputed = await compileSchema("container.computed.yaml");
const [, visualFixture] = yaml.loadAll(
  await readFile(
    resolve(
      testDirectory,
      "../../vt/specs/container/schema-text-revealing.yaml",
    ),
    "utf8",
  ),
);
const parserPlugins = [
  { type: "container", parse: parseContainer },
  { type: "text-revealing", parse: parseTextRevealing },
];

const revealingChild = () => ({
  id: "line",
  type: "text-revealing",
  x: 24,
  y: 16,
  content: [{ text: "Container text" }],
  revealEffect: "none",
});

const container = (overrides = {}) => ({
  id: "container",
  type: "container",
  children: [revealingChild()],
  ...overrides,
});

const expectValid = (validate, value) => {
  expect(validate(value), JSON.stringify(validate.errors, null, 2)).toBe(true);
};

describe("container element schema", () => {
  it.each([{}, { x: 20 }, { y: 30 }, { x: 20, y: 30 }])(
    "accepts optional container coordinates %j with a revealing-text child",
    (coordinates) => {
      expectValid(validateInput, container(coordinates));
    },
  );

  it("accepts nested containers with omitted coordinates", () => {
    expectValid(
      validateInput,
      container({ children: [container({ id: "nested" })] }),
    );
  });

  it.each([
    {
      id: "sprite",
      type: "sprite",
      x: 0,
      y: 0,
      width: 20,
      height: 30,
      src: "image",
    },
    {
      id: "text",
      type: "text",
      x: 0,
      y: 0,
      content: [{ text: "Text" }],
    },
    {
      id: "rect",
      type: "rect",
      x: 0,
      y: 0,
      width: 20,
      height: 30,
      fill: "#FFFFFF",
    },
  ])("continues to accept a $type child", (child) => {
    expectValid(validateInput, container({ children: [child] }));
  });

  it.each(["x", "y"])(
    "still requires the revealing-text child's %s coordinate",
    (coordinate) => {
      const child = revealingChild();
      delete child[coordinate];
      expect(validateInput(container({ children: [child] }))).toBe(false);
      expect(validateInput.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            instancePath: "/children/0",
            keyword: "required",
            params: { missingProperty: coordinate },
          }),
        ]),
      );
    },
  );

  it.each(["x", "y"])("rejects a nonnumeric container %s", (coordinate) => {
    expect(validateInput(container({ [coordinate]: "20" }))).toBe(false);
  });

  it.each(["id", "type"])("still requires the container %s", (property) => {
    const input = container();
    delete input[property];
    expect(validateInput(input)).toBe(false);
  });

  it("rejects invalid revealing-text children through the referenced schema", () => {
    const child = revealingChild();
    child.revealEffect = "unsupported-effect";
    expect(validateInput(container({ children: [child] }))).toBe(false);
  });

  it("rejects unsupported child types", () => {
    expect(
      validateInput(
        container({
          children: [{ id: "unknown", type: "unknown", x: 0, y: 0 }],
        }),
      ),
    ).toBe(false);
  });

  it.each(visualFixture.states.map((state, index) => [index, state]))(
    "accepts visual state %i as input and after parsing",
    (_, state) => {
      for (const element of state.elements) {
        expectValid(validateInput, element);
        const computed = parseContainer({ state: element, parserPlugins });
        expectValid(validateComputed, computed);
      }
    },
  );

  it.each(["x", "y"])(
    "still requires computed container %s after defaulting",
    (coordinate) => {
      const computed = parseContainer({ state: container(), parserPlugins });
      expectValid(validateComputed, computed);
      delete computed[coordinate];
      expect(validateComputed(computed)).toBe(false);
    },
  );
});
