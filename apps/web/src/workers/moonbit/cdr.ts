export function isCdrLittleEndian(payload: Uint8Array): boolean {
  return (
    payload.length >= 4 &&
    payload[0] === 0x00 &&
    payload[1] === 0x01 &&
    payload[2] === 0x00 &&
    payload[3] === 0x00
  );
}

export function decodeStdMsgsFloat64(payload: Uint8Array): number | null {
  if (!isCdrLittleEndian(payload) || payload.length < 16) {
    return null;
  }

  const view = new DataView(payload.buffer, payload.byteOffset + 8, 8);
  return view.getFloat64(0, true);
}

export function hasCdrDecoder(topicType: string): boolean {
  return topicType === "std_msgs/msg/Float64";
}

export function validateKnownCdrPayload(topicType: string, payload: Uint8Array): boolean {
  switch (topicType) {
    case "std_msgs/msg/Float64":
      return decodeStdMsgsFloat64(payload) !== null;
    default:
      return false;
  }
}
