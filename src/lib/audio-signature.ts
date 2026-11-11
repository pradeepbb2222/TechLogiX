function isValidMpegFrame(bytes: Uint8Array, offset: number): boolean {
  if (bytes.length - offset < 4) {
    return false;
  }

  const first = bytes[offset];
  const second = bytes[offset + 1];
  const third = bytes[offset + 2];

  const version = (second >> 3) & 0x03;
  const layer = (second >> 1) & 0x03;
  const bitrateIndex = (third >> 4) & 0x0f;
  const sampleRateIndex = (third >> 2) & 0x03;

  return (
    first === 0xff &&
    (second & 0xe0) === 0xe0 &&
    version !== 0x01 &&
    layer !== 0x00 &&
    bitrateIndex !== 0x00 &&
    bitrateIndex !== 0x0f &&
    sampleRateIndex !== 0x03
  );
}
function isValidMp4Ftyp(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== "ftyp") {
    return false;
  }

  const boxSize =
    bytes[0] * 0x1000000 +
    bytes[1] * 0x10000 +
    bytes[2] * 0x100 +
    bytes[3];

  if (
    boxSize < 16 ||
    boxSize > bytes.length ||
    (boxSize - 16) % 4 !== 0
  ) {
    return false;
  }

  const isPrintableBrand = (offset: number): boolean => {
    for (let i = 0; i < 4; i++) {
      if (bytes[offset + i] < 0x20 || bytes[offset + i] > 0x7e) {
        return false;
      }
    }

    return true;
  };

  if (!isPrintableBrand(8)) {
    return false;
  }

  for (let offset = 16; offset < boxSize; offset += 4) {
    if (!isPrintableBrand(offset)) {
      return false;
    }
  }

  return true;
}
const SIGNATURE_CHECKS: Record<string, (bytes: Uint8Array) => boolean> = {
  "audio/webm": (bytes) =>
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3,

  "audio/wav": (bytes) =>
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WAVE",

  "audio/ogg": (bytes) =>
    bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS",

  "audio/mp4": isValidMp4Ftyp,

  "audio/mpeg": (bytes) => {
    if (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") {
      if (bytes.length < 10) {
        return false;
      }

      const majorVersion = bytes[3];
      const revision = bytes[4];
      const flags = bytes[5];

      if (
        majorVersion < 2 ||
        majorVersion > 4 ||
        revision === 0xff
      ) {
        return false;
      }

      const allowedFlags =
        majorVersion === 2 ? 0xc0 :
        majorVersion === 3 ? 0xe0 :
        0xf0;

      if ((flags & ~allowedFlags) !== 0) {
        return false;
      }

      const sizeBytes = bytes.subarray(6, 10);

      // ID3 tag sizes use four 7-bit synchsafe bytes.
      if (sizeBytes.some((byte) => (byte & 0x80) !== 0)) {
        return false;
      }

      const tagSize =
        (sizeBytes[0] << 21) |
        (sizeBytes[1] << 14) |
        (sizeBytes[2] << 7) |
        sizeBytes[3];

      const frameOffset = 10 + tagSize;

      return isValidMpegFrame(bytes, frameOffset);
    }

    return isValidMpegFrame(bytes, 0);
  },

  "audio/aac": (bytes) =>
    bytes.length >= 2 &&
    bytes[0] === 0xff &&
    (bytes[1] & 0xf6) === 0xf0,
};

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

export function isAudioSignatureMatchingMimeType(
  bytes: Uint8Array,
  mimeType: string,
): boolean {
  const normalizedMimeType = mimeType.split(";")[0].trim().toLowerCase();
  const check = SIGNATURE_CHECKS[normalizedMimeType];

  return check ? check(bytes) : false;
}
