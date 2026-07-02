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
    return this.readString() !== null;
  }

  readString(): string | null {
    if (!this.align(4)) {
      return null;
    }

    const length = this.readUint32();
    if (length === null) {
      return null;
    }

    if (length === 0) {
      return "";
    }

    if (!this.canRead(length)) {
      return null;
    }

    const bytes = this.payload.subarray(this.offset, this.offset + length);
    this.offset += length;
    const padding = (4 - (length % 4)) % 4;
    if (!this.canRead(padding)) {
      return null;
    }

    this.offset += padding;
    return new TextDecoder().decode(bytes);
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

  skipSequence(skipItem: () => boolean): boolean {
    if (!this.align(4)) {
      return false;
    }

    const length = this.readUint32();
    if (length === null) {
      return false;
    }

    for (let index = 0; index < length; index += 1) {
      if (!skipItem()) {
        return false;
      }
    }

    return true;
  }

  skipPoseStampedFields(): boolean {
    return this.skipHeaderStamp() && this.skipString() && this.skipDoubles(7);
  }

  skipTwistStampedFields(): boolean {
    return this.skipHeaderStamp() && this.skipString() && this.skipDoubles(6);
  }

  skipDiagnosticKeyValue(): boolean {
    return this.skipString() && this.skipString();
  }

  skipDiagnosticStatus(): boolean {
    return (
      this.skipUint8() &&
      this.align(4) &&
      this.skipString() &&
      this.skipString() &&
      this.skipString() &&
      this.skipSequence(() => this.skipDiagnosticKeyValue())
    );
  }

  readDiagnosticStatusLevelAndName(): { level: number; name: string } | null {
    const level = this.readUint8();
    if (level === null || !this.align(4)) {
      return null;
    }

    const name = this.readString();
    const message = this.readString();
    const hardwareId = this.readString();
    if (name === null || message === null || hardwareId === null) {
      return null;
    }

    if (!this.skipSequence(() => this.skipDiagnosticKeyValue())) {
      return null;
    }

    return { level, name };
  }

  readUint8(): number | null {
    if (!this.canRead(1)) {
      return null;
    }

    const value = this.payload[this.offset];
    this.offset += 1;
    return value;
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

export function decodeStdMsgsInt32(payload: Uint8Array): number | null {
  if (!isCdrLittleEndian(payload) || payload.length !== 8) {
    return null;
  }

  const view = new DataView(payload.buffer, payload.byteOffset + 4, 4);
  return view.getInt32(0, true);
}

export function decodeStdMsgsUInt32(payload: Uint8Array): number | null {
  if (!isCdrLittleEndian(payload) || payload.length !== 8) {
    return null;
  }

  const view = new DataView(payload.buffer, payload.byteOffset + 4, 4);
  return view.getUint32(0, true);
}

export function decodeGeometryMsgsPoseStampedXY(payload: Uint8Array): { x: number; y: number } | null {
  return decodeHeaderPoseXY(payload);
}

export function decodeGeometryMsgsPoseWithCovarianceStampedXY(payload: Uint8Array): { x: number; y: number } | null {
  return decodeHeaderPoseXY(payload);
}

function decodeHeaderPoseXY(payload: Uint8Array): { x: number; y: number } | null {
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

  return reader.skipPoseStampedFields() && reader.consumedEntirePayload();
}

export function validateGeometryMsgsPoseWithCovarianceStamped(payload: Uint8Array): boolean {
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
    reader.skipDoubles(43) &&
    reader.consumedEntirePayload()
  );
}

export function validateGeometryMsgsTwistStamped(payload: Uint8Array): boolean {
  if (!isCdrLittleEndian(payload)) {
    return false;
  }

  const reader = new CdrReader(payload);
  if (!reader.skipEncapsulation()) {
    return false;
  }

  return reader.skipTwistStampedFields() && reader.consumedEntirePayload();
}

export function validateGeometryMsgsTwistWithCovarianceStamped(payload: Uint8Array): boolean {
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
    reader.skipDoubles(42) &&
    reader.consumedEntirePayload()
  );
}

export function validateDiagnosticMsgsDiagnosticArray(payload: Uint8Array): boolean {
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
    reader.skipSequence(() => reader.skipDiagnosticStatus()) &&
    reader.consumedEntirePayload()
  );
}

export interface DiagnosticArraySummary {
  ok: number;
  warnings: number;
  errors: number;
  stale: number;
  sampleErrorName: string | null;
}

export function summarizeDiagnosticMsgsDiagnosticArray(payload: Uint8Array): DiagnosticArraySummary | null {
  if (!isCdrLittleEndian(payload)) {
    return null;
  }

  const reader = new CdrReader(payload);
  if (!reader.skipEncapsulation() || !reader.skipHeaderStamp() || !reader.skipString()) {
    return null;
  }

  const summary: DiagnosticArraySummary = {
    ok: 0,
    warnings: 0,
    errors: 0,
    stale: 0,
    sampleErrorName: null
  };

  let parsed = true;
  reader.skipSequence(() => {
    const status = reader.readDiagnosticStatusLevelAndName();
    if (status === null) {
      parsed = false;
      return false;
    }

    const { level, name } = status;
    if (level === 0) {
      summary.ok += 1;
    } else if (level === 1) {
      summary.warnings += 1;
    } else if (level === 2) {
      summary.errors += 1;
      if (summary.sampleErrorName === null) {
        summary.sampleErrorName = name.length > 0 ? name : "diagnostic error";
      }
    } else if (level === 3) {
      summary.stale += 1;
      summary.warnings += 1;
    }

    return true;
  });

  if (!parsed || !reader.consumedEntirePayload()) {
    return null;
  }

  return summary;
}

export function validateNavMsgsPath(payload: Uint8Array): boolean {
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
    reader.skipSequence(() => reader.skipPoseStampedFields()) &&
    reader.consumedEntirePayload()
  );
}

export function decodeNavMsgsPathXY(payload: Uint8Array): { x: number; y: number }[] | null {
  if (!isCdrLittleEndian(payload)) {
    return null;
  }

  const reader = new CdrReader(payload);
  if (!reader.skipEncapsulation() || !reader.skipHeaderStamp() || !reader.skipString()) {
    return null;
  }

  const points: { x: number; y: number }[] = [];
  let parsed = true;

  reader.skipSequence(() => {
    if (!reader.skipHeaderStamp() || !reader.skipString()) {
      parsed = false;
      return false;
    }

    const x = reader.readFloat64();
    const y = reader.readFloat64();
    if (x === null || y === null || !reader.skipDoubles(5)) {
      parsed = false;
      return false;
    }

    points.push({ x, y });
    return true;
  });

  if (!parsed || !reader.consumedEntirePayload()) {
    return null;
  }

  return points;
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
    topicType === "std_msgs/msg/Int32" ||
    topicType === "std_msgs/msg/UInt32" ||
    topicType === "diagnostic_msgs/msg/DiagnosticArray" ||
    topicType === "geometry_msgs/msg/PoseStamped" ||
    topicType === "geometry_msgs/msg/PoseWithCovarianceStamped" ||
    topicType === "geometry_msgs/msg/TwistStamped" ||
    topicType === "geometry_msgs/msg/TwistWithCovarianceStamped" ||
    topicType === "nav_msgs/msg/Odometry" ||
    topicType === "nav_msgs/msg/Path" ||
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
    case "std_msgs/msg/Int32":
      return decodeStdMsgsInt32(payload) !== null;
    case "std_msgs/msg/UInt32":
      return decodeStdMsgsUInt32(payload) !== null;
    case "diagnostic_msgs/msg/DiagnosticArray":
      return validateDiagnosticMsgsDiagnosticArray(payload);
    case "geometry_msgs/msg/PoseStamped":
      return validateGeometryMsgsPoseStamped(payload);
    case "geometry_msgs/msg/PoseWithCovarianceStamped":
      return validateGeometryMsgsPoseWithCovarianceStamped(payload);
    case "geometry_msgs/msg/TwistStamped":
      return validateGeometryMsgsTwistStamped(payload);
    case "geometry_msgs/msg/TwistWithCovarianceStamped":
      return validateGeometryMsgsTwistWithCovarianceStamped(payload);
    case "nav_msgs/msg/Odometry":
      return validateNavMsgsOdometry(payload);
    case "nav_msgs/msg/Path":
      return validateNavMsgsPath(payload);
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

export function buildMinimalStdMsgsInt32Payload(value = 0): Uint8Array {
  const payload = new Uint8Array(8);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setInt32(4, value, true);
  return payload;
}

export function buildMinimalStdMsgsUInt32Payload(value = 0): Uint8Array {
  const payload = new Uint8Array(8);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setUint32(4, value, true);
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

export function buildMinimalGeometryMsgsPoseWithCovarianceStampedPayload(
  position: { x?: number; y?: number; z?: number } = {}
): Uint8Array {
  const payload = new Uint8Array(368);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;

  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat64(24, position.x ?? 0, true);
  view.setFloat64(32, position.y ?? 0, true);
  view.setFloat64(40, position.z ?? 0, true);

  return payload;
}

export function buildMinimalGeometryMsgsTwistStampedPayload(
  twist: { linearX?: number; linearY?: number; linearZ?: number; angularX?: number; angularY?: number; angularZ?: number } = {}
): Uint8Array {
  const payload = new Uint8Array(72);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;

  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat64(24, twist.linearX ?? 0, true);
  view.setFloat64(32, twist.linearY ?? 0, true);
  view.setFloat64(40, twist.linearZ ?? 0, true);
  view.setFloat64(48, twist.angularX ?? 0, true);
  view.setFloat64(56, twist.angularY ?? 0, true);
  view.setFloat64(64, twist.angularZ ?? 0, true);

  return payload;
}

export function buildMinimalGeometryMsgsTwistWithCovarianceStampedPayload(
  twist: { linearX?: number; linearY?: number; linearZ?: number } = {}
): Uint8Array {
  const payload = new Uint8Array(360);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;

  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat64(24, twist.linearX ?? 0, true);
  view.setFloat64(32, twist.linearY ?? 0, true);
  view.setFloat64(40, twist.linearZ ?? 0, true);

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

function writeCdrString(payload: Uint8Array, offset: number, value: string): number {
  const aligned = offset + ((4 - (offset % 4)) % 4);
  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setUint32(aligned, value.length, true);
  let next = aligned + 4;
  for (let index = 0; index < value.length; index += 1) {
    payload[next + index] = value.charCodeAt(index);
  }
  next += value.length;
  const padding = (4 - (value.length % 4)) % 4;
  return next + padding;
}

function writeCdrSequenceHeader(payload: Uint8Array, offset: number, length: number): number {
  const aligned = offset + ((4 - (offset % 4)) % 4);
  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setUint32(aligned, length, true);
  return aligned + 4;
}

export function buildMinimalDiagnosticMsgsDiagnosticArrayPayload(
  statuses: readonly { level: number; name?: string; message?: string; hardwareId?: string }[] = [{ level: 2, name: "cpu", message: "overheated" }]
): Uint8Array {
  const payload = new Uint8Array(256);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;

  let offset = writeCdrSequenceHeader(payload, 20, statuses.length);
  for (const status of statuses) {
    payload[offset] = status.level;
    offset += 1;
    offset = writeCdrString(payload, offset, status.name ?? "node");
    offset = writeCdrString(payload, offset, status.message ?? "fault");
    offset = writeCdrString(payload, offset, status.hardwareId ?? "hw");
    offset = writeCdrSequenceHeader(payload, offset, 0);
  }

  return payload.slice(0, offset);
}

export function buildMinimalNavMsgsPathPayload(
  points: readonly { x?: number; y?: number; z?: number }[] = [{ x: 0, y: 0 }, { x: 1, y: 2 }]
): Uint8Array {
  const payload = new Uint8Array(512);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;

  let offset = writeCdrSequenceHeader(payload, 20, points.length);
  const view = new DataView(payload.buffer, payload.byteOffset);

  for (const point of points) {
    offset += 8;
    offset = writeCdrString(payload, offset, "map");
    const poseOffset = offset + ((8 - (offset % 8)) % 8);
    view.setFloat64(poseOffset, point.x ?? 0, true);
    view.setFloat64(poseOffset + 8, point.y ?? 0, true);
    view.setFloat64(poseOffset + 16, point.z ?? 0, true);
    offset = poseOffset + 56;
  }

  return payload.slice(0, offset);
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
