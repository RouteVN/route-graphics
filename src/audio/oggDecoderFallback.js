const OGG_AUDIO_TYPES = new Set(["audio/ogg", "application/ogg"]);

const decoderState = {
  opus: {
    decoderPromise: null,
    queue: Promise.resolve(),
  },
  vorbis: {
    decoderPromise: null,
    queue: Promise.resolve(),
  },
};

const audioTypeSupport = new Map();

const toBytes = (arrayBuffer) =>
  arrayBuffer instanceof Uint8Array
    ? arrayBuffer
    : new Uint8Array(arrayBuffer ?? new ArrayBuffer(0));

const includesAscii = (bytes, marker) => {
  const markerCodes = Array.from(marker, (char) => char.charCodeAt(0));
  const lastStart = bytes.length - markerCodes.length;

  for (let index = 0; index <= lastStart; index += 1) {
    let matched = true;
    for (
      let markerIndex = 0;
      markerIndex < markerCodes.length;
      markerIndex += 1
    ) {
      if (bytes[index + markerIndex] !== markerCodes[markerIndex]) {
        matched = false;
        break;
      }
    }

    if (matched) return true;
  }

  return false;
};

const canPlayAudioType = (type) => {
  if (audioTypeSupport.has(type)) {
    return audioTypeSupport.get(type);
  }

  let supported = false;
  try {
    const audio = globalThis.document?.createElement?.("audio");
    supported =
      typeof audio?.canPlayType === "function" &&
      audio.canPlayType(type) !== "";
  } catch {
    supported = false;
  }

  audioTypeSupport.set(type, supported);
  return supported;
};

const getNormalizedType = (type) => {
  if (typeof type !== "string") return "";
  return type.split(";")[0].trim().toLowerCase();
};

export const isOggAudioType = (type) => {
  return OGG_AUDIO_TYPES.has(getNormalizedType(type));
};

export const detectOggCodec = (arrayBuffer) => {
  const bytes = toBytes(arrayBuffer);

  if (includesAscii(bytes, "OpusHead")) return "opus";
  if (includesAscii(bytes, "vorbis")) return "vorbis";

  return "unknown";
};

const canNativeDecodeOggCodec = (codec) => {
  if (codec === "opus") {
    return (
      canPlayAudioType('audio/ogg; codecs="opus"') ||
      canPlayAudioType("audio/ogg")
    );
  }

  if (codec === "vorbis") {
    return (
      canPlayAudioType('audio/ogg; codecs="vorbis"') ||
      canPlayAudioType("audio/ogg")
    );
  }

  return canPlayAudioType("audio/ogg");
};

const createAudioBuffer = ({
  audioContext,
  channelData,
  sampleRate,
  samplesDecoded,
}) => {
  const channelCount = channelData.length;
  if (channelCount === 0) {
    throw new Error("Ogg decoder returned no audio channels.");
  }

  const length = Math.max(
    0,
    samplesDecoded ?? Math.max(...channelData.map((channel) => channel.length)),
  );

  if (length === 0) {
    throw new Error("Ogg decoder returned an empty audio buffer.");
  }

  const audioBuffer = audioContext.createBuffer(
    channelCount,
    length,
    sampleRate,
  );
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const sourceChannel = channelData[channelIndex];
    audioBuffer
      .getChannelData(channelIndex)
      .set(sourceChannel.subarray(0, length));
  }

  return audioBuffer;
};

const loadOpusDecoder = async () => {
  if (!decoderState.opus.decoderPromise) {
    decoderState.opus.decoderPromise = import("ogg-opus-decoder").then(
      async ({ OggOpusDecoder }) => {
        const decoder = new OggOpusDecoder();
        await decoder.ready;
        return decoder;
      },
    );
  }

  return decoderState.opus.decoderPromise;
};

const loadVorbisDecoder = async () => {
  if (!decoderState.vorbis.decoderPromise) {
    decoderState.vorbis.decoderPromise =
      import("@wasm-audio-decoders/ogg-vorbis").then(
        async ({ OggVorbisDecoder }) => {
          const decoder = new OggVorbisDecoder();
          await decoder.ready;
          return decoder;
        },
      );
  }

  return decoderState.vorbis.decoderPromise;
};

const getDecoder = (codec) => {
  if (codec === "opus") return loadOpusDecoder();
  if (codec === "vorbis") return loadVorbisDecoder();

  throw new Error(`Unsupported Ogg codec "${codec}".`);
};

const decodeWithQueuedDecoder = async ({ codec, bytes }) => {
  const state = decoderState[codec];
  const run = async () => {
    const decoder = await getDecoder(codec);
    const decoded = await decoder.decodeFile(bytes);
    await decoder.reset?.();
    return decoded;
  };

  const result = state.queue.then(run, run);
  state.queue = result.catch(() => {});

  return result;
};

export const prepareOggDecoders = async (assetMap = {}) => {
  const codecsToPrepare = new Set();

  for (const asset of Object.values(assetMap)) {
    if (!isOggAudioType(asset?.type) || !asset?.buffer) {
      continue;
    }

    const codec = detectOggCodec(asset.buffer);
    if (codec === "unknown" || canNativeDecodeOggCodec(codec)) {
      continue;
    }

    codecsToPrepare.add(codec);
  }

  await Promise.all([...codecsToPrepare].map((codec) => getDecoder(codec)));
};

export const decodeOggToAudioBuffer = async ({ arrayBuffer, audioContext }) => {
  const codec = detectOggCodec(arrayBuffer);
  const bytes = toBytes(arrayBuffer);
  const decoded = await decodeWithQueuedDecoder({ codec, bytes });

  return createAudioBuffer({
    audioContext,
    channelData: decoded.channelData ?? [],
    sampleRate: decoded.sampleRate,
    samplesDecoded: decoded.samplesDecoded,
  });
};
