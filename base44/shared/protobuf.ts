// Minimal protobuf encoder/decoder for Apple Live Caller ID Lookup.
//
// Apple's Live Caller ID Lookup uses protocol buffer messages over HTTP
// (Homomorphic Encryption Protobuf). This module implements just enough
// protobuf wire-format encoding/decoding to produce valid ConfigResponse,
// EvaluationKeys, Requests, and Responses messages without a full protobuf
// library.

// ─── Encoding ──────────────────────────────────────────────────────────────

export function encodeVarint(value: number | bigint): Uint8Array {
  let v = BigInt(value);
  if (v < 0n) v += 1n << 64n; // treat negative as unsigned 64-bit
  const bytes: number[] = [];
  do {
    let byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (v > 0n);
  return new Uint8Array(bytes);
}

export function encodeTag(fieldNumber: number, wireType: number): Uint8Array {
  return encodeVarint((fieldNumber << 3) | wireType);
}

export function encodeVarintField(fieldNumber: number, value: number | bigint): Uint8Array {
  return concat(encodeTag(fieldNumber, 0), encodeVarint(value));
}

export function encodeLengthDelimited(fieldNumber: number, data: Uint8Array): Uint8Array {
  return concat(encodeTag(fieldNumber, 2), encodeVarint(data.length), data);
}

export function encodeStringField(fieldNumber: number, str: string): Uint8Array {
  return encodeLengthDelimited(fieldNumber, new TextEncoder().encode(str));
}

export function encodeBytesField(fieldNumber: number, bytes: Uint8Array): Uint8Array {
  return encodeLengthDelimited(fieldNumber, bytes);
}

export function encodeMessageField(fieldNumber: number, messageBytes: Uint8Array): Uint8Array {
  return encodeLengthDelimited(fieldNumber, messageBytes);
}

export function encodeBoolField(fieldNumber: number, value: boolean): Uint8Array {
  return encodeVarintField(fieldNumber, value ? 1 : 0);
}

export function encodeInt32Field(fieldNumber: number, value: number): Uint8Array {
  return encodeVarintField(fieldNumber, value);
}

export function encodeInt64Field(fieldNumber: number, value: number | bigint): Uint8Array {
  return encodeVarintField(fieldNumber, value);
}

// Encode a map<string, Message> field (protobuf maps are repeated entry messages)
export function encodeStringMapField(
  fieldNumber: number,
  entries: Array<[string, Uint8Array]>
): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const [key, valueBytes] of entries) {
    const entry = concat(encodeStringField(1, key), encodeMessageField(2, valueBytes));
    parts.push(encodeMessageField(fieldNumber, entry));
  }
  return concat(...parts);
}

// ─── Decoding ──────────────────────────────────────────────────────────────

export function decodeVarint(bytes: Uint8Array, offset: number): [bigint, number] {
  let result = 0n;
  let shift = 0n;
  while (offset < bytes.length) {
    const byte = bytes[offset];
    offset++;
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [result, offset];
    shift += 7n;
  }
  return [result, offset];
}

export function decodeTag(bytes: Uint8Array, offset: number): [number, number, number] {
  const [tag, newOffset] = decodeVarint(bytes, offset);
  return [Number(tag >> 3n), Number(tag & 0x7n), newOffset];
}

export function decodeLengthDelimited(bytes: Uint8Array, offset: number): [Uint8Array, number] {
  const [length, lenOffset] = decodeVarint(bytes, offset);
  const len = Number(length);
  const data = bytes.slice(lenOffset, lenOffset + len);
  return [data, lenOffset + len];
}

export function decodeVarintField(bytes: Uint8Array, offset: number): [bigint, number] {
  return decodeVarint(bytes, offset);
}

// Parse all fields from a protobuf message into a map: fieldNumber -> [raw values]
export function parseFields(data: Uint8Array): Map<number, Array<{ wireType: number; data: Uint8Array | bigint }>> {
  const fields = new Map<number, Array<{ wireType: number; data: Uint8Array | bigint }>>();
  let offset = 0;
  while (offset < data.length) {
    const [fieldNumber, wireType, tagEnd] = decodeTag(data, offset);
    offset = tagEnd;
    if (wireType === 0) {
      // varint
      const [value, end] = decodeVarint(data, offset);
      offset = end;
      if (!fields.has(fieldNumber)) fields.set(fieldNumber, []);
      fields.get(fieldNumber)!.push({ wireType, data: value });
    } else if (wireType === 2) {
      // length-delimited
      const [value, end] = decodeLengthDelimited(data, offset);
      offset = end;
      if (!fields.has(fieldNumber)) fields.set(fieldNumber, []);
      fields.get(fieldNumber)!.push({ wireType, data: value });
    } else if (wireType === 1) {
      // 64-bit
      const value = data.slice(offset, offset + 8);
      offset += 8;
      if (!fields.has(fieldNumber)) fields.set(fieldNumber, []);
      fields.get(fieldNumber)!.push({ wireType, data: value });
    } else if (wireType === 5) {
      // 32-bit
      const value = data.slice(offset, offset + 4);
      offset += 4;
      if (!fields.has(fieldNumber)) fields.set(fieldNumber, []);
      fields.get(fieldNumber)!.push({ wireType, data: value });
    } else {
      break; // unknown wire type
    }
  }
  return fields;
}

// ─── Utility ───────────────────────────────────────────────────────────────

export function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}