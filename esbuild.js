import esbuild from "esbuild";

try {
  await Promise.all([
    esbuild.build({
      entryPoints: ["./src/index.js"],
      bundle: true,
      minify: true,
      sourcemap: false,
      outfile: "./dist/RouteGraphics.js",
      format: "esm",
    }),
    esbuild.build({
      entryPoints: ["./src/index.js"],
      bundle: true,
      minify: false,
      sourcemap: true,
      outfile: "./vt/static/RouteGraphics.js",
      format: "esm",
    }),
  ]);
} catch (error) {
  console.error(error);
  process.exit(1);
}
