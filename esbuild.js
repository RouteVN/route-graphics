import esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

try {
  const buildBundle = async ({ outdir, minify, sourcemap }) => {
    await Promise.all([
      rm(path.join(outdir, "RouteGraphics.js"), { force: true }),
      rm(path.join(outdir, "RouteGraphics.js.map"), { force: true }),
      rm(path.join(outdir, "chunks"), { force: true, recursive: true }),
    ]);

    await esbuild.build({
      entryPoints: ["./src/index.js"],
      bundle: true,
      minify,
      sourcemap,
      outdir,
      entryNames: "RouteGraphics",
      chunkNames: "chunks/[name]-[hash]",
      format: "esm",
      splitting: true,
    });
  };

  await Promise.all([
    buildBundle({
      outdir: "./dist",
      minify: true,
      sourcemap: false,
    }),
    buildBundle({
      outdir: "./playground/static",
      minify: true,
      sourcemap: false,
    }),
    buildBundle({
      outdir: "./vt/static",
      minify: false,
      sourcemap: true,
    }),
  ]);

  await mkdir("./.rettangoli/vt/_site", { recursive: true });
  await Promise.all([
    cp("./vt/static/RouteGraphics.js", "./.rettangoli/vt/_site/RouteGraphics.js"),
    cp(
      "./vt/static/RouteGraphics.js.map",
      "./.rettangoli/vt/_site/RouteGraphics.js.map",
    ),
    cp("./vt/static/chunks", "./.rettangoli/vt/_site/chunks", {
      force: true,
      recursive: true,
    }),
  ]);
} catch (error) {
  console.error(error);
  process.exit(1);
}
