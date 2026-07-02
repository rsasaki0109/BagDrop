export function isCdrLittleEndian(payload: Uint8Array): boolean {
  return (
    payload.length >= 4 &&
    payload[0] === 0x00 &&
    payload[1] === 0x01 &&
    payload[2] === 0x00 &&
    payload[3] === 0x00
  );
}

class CdrReader {
  private offset = 0;

  constructor(private readonly payload: Uint8Array) {}

  skipEncapsulation(): boolean {
    if (!this.canRead(4)) {
      return false;
    }

    this.offset += 4;
    return true;
  }

  private align(alignment: number): boolean {
    const remainder = this.offset % alignment;
    if (remainder !== 0) {
      this.offset += alignment - remainder;
    }

    return this.offset <= this.payload.length;
  }

  private canRead(bytes: number): boolean {
    return this.offset + bytes <= this.payload.length;
  }

  private readUint32(): number | null {
    if (!this.canRead(4)) {
      return null;
    }

    const view = new DataView(this.payload.buffer, this.payload.byteOffset + this.offset, 4);
    this.offset += 4;
    return view.getUint32(0, true);
  }

  skipString(): boolean {
    if (!this.align(4)) {
      return false;
    }

    const length = this.readUint32();
    if (length === null || length === 0) {
      return false;
    }

    if (!this.canRead(length)) {
      return false;
    }

    this.offset += length;
    const padding = (4 - (length % 4)) % 4;
    if (!this.canRead(padding)) {
      return false;
    }

    this.offset += padding;
    return true;
  }

  skipDoubles(count: number): boolean {
    if (!this.align(8)) {
      return false;
    }

    const bytes = count * 8;
    if (!this.canRead(bytes)) {
      return false;
    }

    this.offset += bytes;
    return true;
  }

  skipHeaderStamp(): boolean {
    if (!this.canRead(8)) {
      return false;
    }

    this.offset += 8;
    return true;
  }

  skipUint8(): boolean {
    if (!this.canRead(1)) {
      return false;
    }

    this.offset += 1;
    return true;
  }

  skipUint16(): boolean {
    if (!this.align(2) || !this.canRead(2)) {
      return false;
    }

    this.offset += 2;
    return true;
  }
}

export function decodeStdMsgsFloat64(payload: Uint8Array): number | null {
  if (!isCdrLittleEndian(payload) || payload.length !== 16) {
    return null;
  }

  const view = new DataView(payload.buffer, payload.byteOffset + 8, 8);
  return view.getFloat64(0, true);
}

export function validateNavMsgsOdometry(payload: Uint8Array): boolean {
  if (!isCdrLittleEndian(payload)) {
    return false;
  }

  const reader = new CdrReader(payload);
  if (!reader.skipEncapsulation()) {
    return false;
  }

  return (
    reader.skipHeaderStamp() &&
    reader.skipString() &&
    reader.skipString() &&
    reader.skipDoubles(7) &&
    reader.skipDoubles(36) &&
    reader.skipDoubles(6) &&
    reader.skipDoubles(36)
  );
}

export function validateSensorMsgsNavSatFix(payload: Uint8Array): boolean {
  if (!isCdrLittleEndian(payload)) {
    return false;
  }

  const reader = new CdrReader(payload);
  if (!reader.skipEncapsulation()) {
    return false;
  }

  return (
    reader.skipHeaderStamp() &&
    reader.skipString() &&
    reader.skipUint8() &&
    reader.skipUint16() &&
    reader.skipDoubles(3) &&
    reader.skipDoubles(9) &&
    reader.skipUint8()
  );
}

export function hasCdrDecoder(topicType: string): boolean {
  return (
    topicType === "std_msgs/msg/Float64" ||
    topicType === "nav_msgs/msg/Odometry" ||
    topicType === "sensor_msgs/msg/NavSatFix"
  );
}

export function validateKnownCdrPayload(topicType: string, payload: Uint8Array): boolean {
  switch (topicType) {
    case "std_msgs/msg/Float64":
      return decodeStdMsgsFloat64(payload) !== null;
    case "nav_msgs/msg/Odometry":
      return validateNavMsgsOdometry(payload);
    case "sensor_msgs/msg/NavSatFix":
      return validateSensorMsgsNavSatFix(payload);
    default:
      return false;
  }
}

export function buildMinimalNavMsgsOdometryPayload(): Uint8Array {
  const payload = new Uint8Array(712);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);

  let offset = 12;
  for (const stringLength of [1, 1]) {
    payload[offset] = stringLength;
    payload[offset + 4] = 0x00;
    offset += 8;
  }

  return payload;
}

export function buildMinimalSensorMsgsNavSatFixPayload(): Uint8Array {
  const payload = new Uint8Array(121);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;
  return payload;
}
