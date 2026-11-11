import assert from "node:assert/strict";
import { test } from "node:test";
import { isAudioSignatureMatchingMimeType } from "../src/lib/audio-signature";

function bytesFromAscii(value: string): Uint8Array {
  return new Uint8Array([...value].map((char) => char.charCodeAt(0)));
}

test("recognizes WebM signatures", () => {
  assert.equal(
    isAudioSignatureMatchingMimeType(
      new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00]),
      "audio/webm",
    ),
    true,
  );
});

test("recognizes WAV signatures", () => {
  const bytes = new Uint8Array(12);
  bytes.set(bytesFromAscii("RIFF"), 0);
  bytes.set(bytesFromAscii("WAVE"), 8);

  assert.equal(isAudioSignatureMatchingMimeType(bytes, "audio/wav"), true);
});

test("recognizes OGG signatures", () => {
  assert.equal(
    isAudioSignatureMatchingMimeType(bytesFromAscii("OggS"), "audio/ogg"),
    true,
  );
});

test("recognizes valid MP4/M4A container signatures", () => {
  const bytes = new Uint8Array([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x6d, 0x70, 0x34, 0x32,
    0x00, 0x00, 0x00, 0x00,
    0x6d, 0x70, 0x34, 0x31,
    0x69, 0x73, 0x6f, 0x6d,
  ]);

  assert.equal(isAudioSignatureMatchingMimeType(bytes, "audio/mp4"), true);
});

test("rejects malformed MP4 file-type box sizes", () => {
  const createHeader = () => new Uint8Array([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x6d, 0x70, 0x34, 0x32,
    0x00, 0x00, 0x00, 0x00,
    0x6d, 0x70, 0x34, 0x31,
    0x69, 0x73, 0x6f, 0x6d,
  ]);

  const undersized = createHeader();
  undersized[3] = 12;

  const oversized = createHeader();
  oversized[3] = 25;

  const misaligned = createHeader();
  misaligned[3] = 23;

  assert.equal(isAudioSignatureMatchingMimeType(undersized, "audio/mp4"), false);
  assert.equal(isAudioSignatureMatchingMimeType(oversized, "audio/mp4"), false);
  assert.equal(isAudioSignatureMatchingMimeType(misaligned, "audio/mp4"), false);
});

test("rejects MP4 headers with invalid brand characters", () => {
  const bytes = new Uint8Array([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x00, 0x70, 0x34, 0x32,
    0x00, 0x00, 0x00, 0x00,
    0x6d, 0x70, 0x34, 0x31,
    0x69, 0x73, 0x6f, 0x6d,
  ]);

  assert.equal(isAudioSignatureMatchingMimeType(bytes, "audio/mp4"), false);
});

function createMp3WithId3Tag(): Uint8Array {
  const bytes = new Uint8Array(14);

  bytes.set(bytesFromAscii("ID3"), 0);
  bytes[3] = 4; // ID3v2.4
  bytes[4] = 0; // Revision
  bytes[5] = 0; // Flags
  // Bytes 6-9 are a zero-length synchsafe tag size.

  bytes.set([0xff, 0xfb, 0x90, 0x64], 10);

  return bytes;
}

test("recognizes MP3 with a valid ID3v2 header and MPEG frame", () => {
  assert.equal(
    isAudioSignatureMatchingMimeType(createMp3WithId3Tag(), "audio/mpeg"),
    true,
  );
});

test("recognizes a valid raw MPEG audio frame", () => {
  assert.equal(
    isAudioSignatureMatchingMimeType(
      new Uint8Array([0xff, 0xfb, 0x90, 0x64]),
      "audio/mpeg",
    ),
    true,
  );
});

test("rejects truncated ID3 headers and ID3 tags without an audio frame", () => {
  assert.equal(
    isAudioSignatureMatchingMimeType(bytesFromAscii("ID3"), "audio/mpeg"),
    false,
  );

  assert.equal(
    isAudioSignatureMatchingMimeType(
      new Uint8Array([
        0x49, 0x44, 0x33, 0x04, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
      ]),
      "audio/mpeg",
    ),
    false,
  );
});

test("rejects malformed ID3 synchsafe sizes", () => {
  const bytes = createMp3WithId3Tag();
  bytes[6] = 0x80;

  assert.equal(
    isAudioSignatureMatchingMimeType(bytes, "audio/mpeg"),
    false,
  );
});

test("rejects invalid MPEG frame headers", () => {
  assert.equal(
    isAudioSignatureMatchingMimeType(
      new Uint8Array([0xff, 0xfb, 0x00, 0x64]),
      "audio/mpeg",
    ),
    false,
  );

  assert.equal(
    isAudioSignatureMatchingMimeType(
      new Uint8Array([0xff, 0xee, 0x90, 0x64]),
      "audio/mpeg",
    ),
    false,
  );
});

test("recognizes AAC ADTS signatures", () => {
  assert.equal(
    isAudioSignatureMatchingMimeType(
      new Uint8Array([0xff, 0xf1, 0x50, 0x80]),
      "audio/aac",
    ),
    true,
  );
});

test("rejects a declared MIME type that does not match the signature", () => {
  const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);

  assert.equal(
    isAudioSignatureMatchingMimeType(webm, "audio/mp4"),
    false,
  );
});

test("rejects unknown and truncated signatures", () => {
  assert.equal(
    isAudioSignatureMatchingMimeType(new Uint8Array([0x00, 0x01]), "audio/webm"),
    false,
  );

  assert.equal(
    isAudioSignatureMatchingMimeType(bytesFromAscii("unknown"), "audio/unknown"),
    false,
  );
});

test("normalizes MIME parameters before checking", () => {
  assert.equal(
    isAudioSignatureMatchingMimeType(
      new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
      "audio/webm;codecs=opus",
    ),
    true,
  );
});
