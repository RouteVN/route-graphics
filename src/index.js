import { createAssetBufferManager } from "./util/createAssetBufferManager.js";
import parse from "./parser/index.js";
import { Application, Assets } from "pixi.js";
import parseJSONToAST from "./parser/index.js";
import { AudioAsset } from "./AudioAsset.js";
import { createElementPlugin } from "./plugins/elements/elementPlugin.js";
import { createAnimationPlugin } from "./plugins/animations/animationPlugin.js";
import { createAudioPlugin } from "./plugins/audio/audioPlugin.js";
import { textPlugin } from "./plugins/elements/text/index.js";
import { rectPlugin } from "./plugins/elements/rect/index.js";
import { spritePlugin } from "./plugins/elements/sprite/index.js";
import { sliderPlugin } from "./plugins/elements/slider/index.js";
import { containerPlugin } from "./plugins/elements/container/index.js";
import { textRevealingPlugin } from "./plugins/elements/text-revealing/index.js";
import { tweenPlugin } from "./plugins/animations/tween/index.js";
import { soundPlugin } from "./plugins/audio/sound/soundPlugin.js";
import { renderElements } from "./plugins/renderElements.js";
import { renderAudio } from "./plugins/renderAudio.js";
import createRouteGraphics from "./RouteGraphics.js";

export default createRouteGraphics;

export {
  Application,
  Assets,
  AudioAsset,
  parse,
  parseJSONToAST,
  createAssetBufferManager,
  createElementPlugin,
  createAnimationPlugin,
  createAudioPlugin,
  textPlugin,
  rectPlugin,
  spritePlugin,
  sliderPlugin,
  containerPlugin,
  textRevealingPlugin,
  tweenPlugin,
  soundPlugin,
  renderElements,
  renderAudio,
};
