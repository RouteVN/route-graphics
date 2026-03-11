import {
  Filter,
  GlProgram,
  UniformGroup,
  Texture,
  defaultFilterVert,
} from "pixi.js";

const FRAGMENT_SHADER = `
varying vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uNextTexture;
uniform sampler2D uMaskTexture;

uniform float uHasMask;
uniform float uProgress;
uniform float uSoftness;
uniform float uInvert;
uniform vec4 uChannelWeights;

float readMaskValue(vec2 uv)
{
    vec4 maskSample = texture2D(uMaskTexture, uv);
    float maskValue = dot(maskSample, uChannelWeights);

    if (uInvert > 0.5)
    {
        maskValue = 1.0 - maskValue;
    }

    return maskValue;
}

void main(void)
{
    vec4 prevColor = texture2D(uTexture, vTextureCoord);
    vec4 nextColor = texture2D(uNextTexture, vTextureCoord);

    float softness = max(uSoftness, 0.0001);
    float maskValue = uHasMask > 0.5 ? readMaskValue(vTextureCoord) : vTextureCoord.x;
    float reveal = uHasMask > 0.5
        ? smoothstep(uProgress - softness, uProgress + softness, maskValue)
        : clamp(uProgress, 0.0, 1.0);

    gl_FragColor = mix(prevColor, nextColor, reveal);
}
`;

const CHANNEL_WEIGHTS = {
  red: [1, 0, 0, 0],
  green: [0, 1, 0, 0],
  blue: [0, 0, 1, 0],
  alpha: [0, 0, 0, 1],
};

export class ReplaceDissolveFilter extends Filter {
  constructor({ nextTexture, maskTexture = Texture.EMPTY, mask }) {
    const glProgram = GlProgram.from({
      vertex: defaultFilterVert,
      fragment: FRAGMENT_SHADER,
      name: "route-graphics-replace-dissolve",
    });

    const uniforms = new UniformGroup({
      uHasMask: { value: mask ? 1 : 0, type: "f32" },
      uProgress: { value: 0, type: "f32" },
      uSoftness: { value: mask?.softness ?? 0.001, type: "f32" },
      uInvert: { value: mask?.invert ? 1 : 0, type: "f32" },
      uChannelWeights: {
        value: CHANNEL_WEIGHTS[mask?.channel ?? "red"],
        type: "vec4<f32>",
      },
    });

    super({
      glProgram,
      resources: {
        replaceUniforms: uniforms,
        uNextTexture: nextTexture.source,
        uMaskTexture: maskTexture.source,
      },
    });

    this.resources.replaceUniforms = uniforms;
  }

  setProgress(value) {
    this.resources.replaceUniforms.uniforms.uProgress = value;
  }

  setMaskTexture(texture) {
    this.resources.uMaskTexture = texture.source;
  }
}

export default ReplaceDissolveFilter;
