import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseRouteGraphicsCliArgs,
  parseStateSelection,
  resolveOutputFormat,
  resolveOutputPath,
  runRouteGraphicsCli,
} from "../../src/cli/routeGraphicsCli.js";

const runCli = async (argv) => {
  let stdout = "";
  let stderr = "";
  const exitCode = await runRouteGraphicsCli({
    argv,
    cwd: "/tmp/route-graphics",
    stdout: {
      write: (chunk) => {
        stdout += chunk;
      },
    },
    stderr: {
      write: (chunk) => {
        stderr += chunk;
      },
    },
  });

  return {
    exitCode,
    stdout,
    stderr,
  };
};

describe("route-graphics CLI argument parsing", () => {
  it("parses the render command for PNG output", () => {
    expect(
      parseRouteGraphicsCliArgs([
        "render",
        "./scene.yaml",
        "-o",
        "./out/frame.png",
        "--state",
        "2",
        "--time",
        "500",
      ]),
    ).toMatchObject({
      command: "render",
      inputPath: "./scene.yaml",
      outputPath: "./out/frame.png",
      stateIndex: 2,
      timeMS: 500,
    });
  });

  it("parses the render command for MP4 output", () => {
    expect(
      parseRouteGraphicsCliArgs([
        "render",
        "./scene.yaml",
        "-o",
        "./out/scene.mp4",
        "--states",
        "0,2-4",
        "--fps",
        "60",
        "--hold",
        "250",
        "--initial-hold",
        "500",
        "--final-hold",
        "750",
        "--max-state-duration",
        "3000",
      ]),
    ).toMatchObject({
      command: "render",
      inputPath: "./scene.yaml",
      outputPath: "./out/scene.mp4",
      stateSelection: "0,2-4",
      fps: 60,
      holdMS: 250,
      initialHoldMS: 500,
      finalHoldMS: 750,
      maxStateDurationMS: 3000,
    });
  });

  it("rejects unknown commands", () => {
    expect(() => parseRouteGraphicsCliArgs(["export"])).toThrow(
      /Unknown command/,
    );
  });

  it("rejects missing option values", () => {
    expect(() =>
      parseRouteGraphicsCliArgs(["render", "scene.yaml", "-o"]),
    ).toThrow(/requires a value/);
  });
});

describe("route-graphics CLI output format resolution", () => {
  it("infers PNG and MP4 formats from output extensions", () => {
    expect(resolveOutputFormat({ outputPath: "frame.png" })).toBe("png");
    expect(resolveOutputFormat({ outputPath: "scene.mp4" })).toBe("mp4");
  });

  it("uses explicit format when the output has no extension", () => {
    expect(resolveOutputFormat({ outputPath: "scene", format: "mp4" })).toBe(
      "mp4",
    );
    expect(
      resolveOutputPath({
        cwd: "/tmp/route-graphics",
        outputPath: "scene",
        format: "mp4",
      }),
    ).toBe(path.join("/tmp/route-graphics", "scene.mp4"));
  });

  it("rejects explicit format and extension mismatches", () => {
    expect(() =>
      resolveOutputFormat({ outputPath: "scene.png", format: "mp4" }),
    ).toThrow(/does not match/);
  });

  it("rejects unsupported formats", () => {
    expect(() => resolveOutputFormat({ outputPath: "scene.gif" })).toThrow(
      /Could not infer output format/,
    );
    expect(() =>
      resolveOutputFormat({ outputPath: "scene", format: "gif" }),
    ).toThrow(/Unsupported format/);
  });
});

describe("route-graphics CLI format-specific options", () => {
  it("rejects MP4-only options for PNG output", async () => {
    const result = await runCli([
      "render",
      "scene.yaml",
      "-o",
      "frame.png",
      "--states",
      "0-1",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "--states is only supported for MP4 output.",
    );
  });

  it("rejects PNG-only options for MP4 output", async () => {
    const result = await runCli([
      "render",
      "scene.yaml",
      "-o",
      "scene.mp4",
      "--state",
      "1",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "--state is only supported for PNG output.",
    );
  });

  it("rejects explicit format mismatches before reading input", async () => {
    const result = await runCli([
      "render",
      "missing.yaml",
      "-o",
      "frame.png",
      "--format",
      "mp4",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'Output extension ".png" does not match --format mp4.',
    );
  });
});

describe("parseStateSelection", () => {
  it("selects all states by default", () => {
    expect(parseStateSelection(undefined, 4)).toEqual([0, 1, 2, 3]);
  });

  it("parses comma-separated indexes and ranges", () => {
    expect(parseStateSelection("0,2-4,1", 6)).toEqual([0, 2, 3, 4, 1]);
  });

  it("deduplicates selected states while preserving order", () => {
    expect(parseStateSelection("0,1,1,0,2", 3)).toEqual([0, 1, 2]);
  });

  it("rejects descending ranges", () => {
    expect(() => parseStateSelection("3-1", 5)).toThrow(/ascending/);
  });

  it("rejects out-of-range indexes", () => {
    expect(() => parseStateSelection("0,3", 3)).toThrow(/out of range/);
  });

  it("rejects malformed selections", () => {
    expect(() => parseStateSelection("0,a", 3)).toThrow(/Invalid state/);
  });
});
