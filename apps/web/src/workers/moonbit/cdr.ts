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

  readFloat64(): number | null {
    if (!this.align(8) || !this.canRead(8)) {
      return null;
    }

    const view = new DataView(this.payload.buffer, this.payload.byteOffset + this.offset, 8);
    this.offset += 8;
    return view.getFloat64(0, true);
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

  consumedEntirePayload(): boolean {
    return this.offset === this.payload.length;
  }
}

export function decodeStdMsgsFloat64(payload: Uint8Array): number | null {
  if (!isCdrLittleEndian(payload) || payload.length !== 16) {
    return null;
  }

  const view = new DataView(payload.buffer, payload.byteOffset + 8, 8);
  return view.getFloat64(0, true);
}

export function decodeStdMsgsFloat32(payload: Uint8Array): number | null {
  if (!isCdrLittleEndian(payload) || payload.length !== 8) {
    return null;
  }

  const view = new DataView(payload.buffer, payload.byteOffset + 4, 4);
  return view.getFloat32(0, true);
}

export function decodeGeometryMsgsPoseStampedXY(payload: Uint8Array): { x: number; y: number } | null {
  if (!isCdrLittleEndian(payload)) {
    return null;
  }

  const reader = new CdrReader(payload);
  if (!reader.skipEncapsulation()) {
    return null;
  }

  if (!reader.skipHeaderStamp() || !reader.skipString()) {
    return null;
  }

  const x = reader.readFloat64();
  const y = reader.readFloat64();
  if (x === null || y === null) {
    return null;
  }

  return { x, y };
}

export function decodeNavMsgsOdometryXY(payload: Uint8Array): { x: number; y: number } | null {
  if (!isCdrLittleEndian(payload)) {
    return null;
  }

  const reader = new CdrReader(payload);
  if (!reader.skipEncapsulation()) {
    return null;
  }

  if (!reader.skipHeaderStamp() || !reader.skipString() || !reader.skipString()) {
    return null;
  }

  const x = reader.readFloat64();
  const y = reader.readFloat64();
  if (x === null || y === null) {
    return null;
  }

  return { x, y };
}

export function validateGeometryMsgsPoseStamped(payload: Uint8Array): boolean {
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
    reader.skipDoubles(7) &&
    reader.consumedEntirePayload()
  );
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

export function decodeSensorMsgsNavSatFixLatLon(payload: Uint8Array): { lat: number; lon: number } | null {
  if (!isCdrLittleEndian(payload)) {
    return null;
  }

  const reader = new CdrReader(payload);
  if (!reader.skipEncapsulation()) {
    return null;
  }

  if (!reader.skipHeaderStamp() || !reader.skipString() || !reader.skipUint8() || !reader.skipUint16()) {
    return null;
  }

  const lat = reader.readFloat64();
  const lon = reader.readFloat64();
  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon };
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
    reader.skipUint8() &&
    reader.consumedEntirePayload()
  );
}

export function validateSensorMsgsImu(payload: Uint8Array): boolean {
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
    reader.skipDoubles(4) &&
    reader.skipDoubles(9) &&
    reader.skipDoubles(3) &&
    reader.skipDoubles(9) &&
    reader.skipDoubles(3) &&
    reader.skipDoubles(9) &&
    reader.consumedEntirePayload()
  );
}

export function hasCdrDecoder(topicType: string): boolean {
  return (
    topicType === "std_msgs/msg/Float32" ||
    topicType === "std_msgs/msg/Float64" ||
    topicType === "geometry_msgs/msg/PoseStamped" ||
    topicType === "nav_msgs/msg/Odometry" ||
    topicType === "sensor_msgs/msg/NavSatFix" ||
    topicType === "sensor_msgs/msg/Imu"
  );
}

export function validateKnownCdrPayload(topicType: string, payload: Uint8Array): boolean {
  switch (topicType) {
    case "std_msgs/msg/Float32":
      return decodeStdMsgsFloat32(payload) !== null;
    case "std_msgs/msg/Float64":
      return decodeStdMsgsFloat64(payload) !== null;
    case "geometry_msgs/msg/PoseStamped":
      return validateGeometryMsgsPoseStamped(payload);
    case "nav_msgs/msg/Odometry":
      return validateNavMsgsOdometry(payload);
    case "sensor_msgs/msg/NavSatFix":
      return validateSensorMsgsNavSatFix(payload);
    case "sensor_msgs/msg/Imu":
      return validateSensorMsgsImu(payload);
    default:
      return false;
  }
}

export function buildMinimalStdMsgsFloat64Payload(value = 0): Uint8Array {
  const payload = new Uint8Array(16);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat64(8, value, true);
  return payload;
}

export function buildMinimalStdMsgsFloat32Payload(value = 0): Uint8Array {
  const payload = new Uint8Array(8);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat32(4, value, true);
  return payload;
}

export function buildMinimalGeometryMsgsPoseStampedPayload(position: { x?: number; y?: number; z?: number } = {}): Uint8Array {
  const payload = new Uint8Array(80);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;

  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat64(24, position.x ?? 0, true);
  view.setFloat64(32, position.y ?? 0, true);
  view.setFloat64(40, position.z ?? 0, true);

  return payload;
}

export function buildMinimalNavMsgsOdometryPayload(position: { x?: number; y?: number; z?: number } = {}): Uint8Array {
  const payload = new Uint8Array(712);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);

  let offset = 12;
  for (const stringLength of [1, 1]) {
    payload[offset] = stringLength;
    payload[offset + 4] = 0x00;
    offset += 8;
  }

  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat64(32, position.x ?? 0, true);
  view.setFloat64(40, position.y ?? 0, true);
  view.setFloat64(48, position.z ?? 0, true);

  return payload;
}

export function buildMinimalSensorMsgsNavSatFixPayload(position: { lat?: number; lon?: number; alt?: number } = {}): Uint8Array {
  const payload = new Uint8Array(121);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;

  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat64(24, position.lat ?? 0, true);
  view.setFloat64(32, position.lon ?? 0, true);
  view.setFloat64(40, position.alt ?? 0, true);

  return payload;
}

export function buildMinimalSensorMsgsImuPayload(motion: {
  wx?: number;
  wy?: number;
  wz?: number;
  ax?: number;
  ay?: number;
  az?: number;
} = {}): Uint8Array {
  const payload = new Uint8Array(320);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;

  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat64(128, motion.wx ?? 0, true);
  view.setFloat64(136, motion.wy ?? 0, true);
  view.setFloat64(144, motion.wz ?? 0, true);
  view.setFloat64(224, motion.ax ?? 0, true);
  view.setFloat64(232, motion.ay ?? 0, true);
  view.setFloat64(240, motion.az ?? 0, true);

  return payload;
}
