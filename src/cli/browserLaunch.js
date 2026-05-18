export const getRendererBrowserLaunchOptions = (browserExecutablePath) => ({
  headless: true,
  executablePath: browserExecutablePath,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
