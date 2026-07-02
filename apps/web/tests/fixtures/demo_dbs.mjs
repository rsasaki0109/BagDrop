import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

function sqliteBlobLiteral(payload) {
  const hex = [...payload].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `X'${hex}'`;
}

function buildMinimalStdMsgsFloat64Payload(value = 0) {
  const payload = new Uint8Array(16);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat64(8, value, true);
  return payload;
}

function buildMinimalNavMsgsOdometryPayload(position = {}) {
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

function buildMinimalSensorMsgsNavSatFixPayload(position = {}) {
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

function writeCdrString(payload, offset, value) {
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

function writeCdrSequenceHeader(payload, offset, length) {
  const aligned = offset + ((4 - (offset % 4)) % 4);
  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setUint32(aligned, length, true);
  return aligned + 4;
}

function writeCdrFloat32Sequence(payload, offset, values) {
  let next = writeCdrSequenceHeader(payload, offset, values.length);
  const view = new DataView(payload.buffer, payload.byteOffset);
  for (const value of values) {
    view.setFloat32(next, value, true);
    next += 4;
  }
  return next;
}

function buildMinimalDiagnosticMsgsDiagnosticArrayPayload(
  statuses = [{ level: 2, name: "cpu", message: "overheated" }]
) {
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

function buildMinimalSensorMsgsLaserScanPayload(ranges = [1.0, 2.0], intensities = []) {
  const payload = new Uint8Array(128);
  payload.set([0x00, 0x01, 0x00, 0x00], 0);
  payload[12] = 0x01;
  payload[16] = 0x00;

  const view = new DataView(payload.buffer, payload.byteOffset);
  view.setFloat32(20, -1.0, true);
  view.setFloat32(24, 1.0, true);
  view.setFloat32(28, 0.1, true);
  view.setFloat32(32, 0.0, true);
  view.setFloat32(36, 0.1, true);
  view.setFloat32(40, 0.05, true);
  view.setFloat32(44, 30.0, true);

  let offset = writeCdrFloat32Sequence(payload, 48, ranges);
  offset = writeCdrFloat32Sequence(payload, offset, intensities);

  return payload.slice(0, offset);
}

function buildMinimalSensorMsgsImuPayload(motion = {}) {
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

function buildMinimalGeometryMsgsTwistStampedPayload(twist = {}) {
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

async function createRosbagDb(topicAndMessageSql) {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:");

  try {
    db.exec(`
      CREATE TABLE schema(schema_version INTEGER, ros_distro TEXT);
      CREATE TABLE metadata(key TEXT, value TEXT);
      CREATE TABLE message_definitions(topic_type TEXT, encoding TEXT, encoded_message_definition TEXT);
      CREATE TABLE topics(
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        serialization_format TEXT NOT NULL,
        offered_qos_profiles TEXT,
        type_description_hash TEXT
      );
      CREATE TABLE messages(
        id INTEGER PRIMARY KEY,
        topic_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        data BLOB NOT NULL
      );

      INSERT INTO metadata(key, value) VALUES ('ros_distro', 'jazzy');
      INSERT INTO message_definitions(topic_type, encoding, encoded_message_definition)
        VALUES ('nav_msgs/msg/Odometry', 'ros2msg', 'string child_frame_id');
      ${topicAndMessageSql}
    `);

    return sqlite3.capi.sqlite3_js_db_export(db);
  } finally {
    db.close();
  }
}

export async function createCleanDemoDb() {
  const odomPayload = sqliteBlobLiteral(buildMinimalNavMsgsOdometryPayload({ x: 1, y: 2 }));
  const fixPayload = sqliteBlobLiteral(buildMinimalSensorMsgsNavSatFixPayload({ lat: 35.6, lon: 139.7 }));
  const imuPayloadLow = sqliteBlobLiteral(buildMinimalSensorMsgsImuPayload({ ax: 3, ay: 4, az: 0 }));
  const imuPayloadHigh = sqliteBlobLiteral(buildMinimalSensorMsgsImuPayload({ ax: 0, ay: 0, az: 9.8 }));
  const cmdVelPayloadLow = sqliteBlobLiteral(buildMinimalGeometryMsgsTwistStampedPayload({ linearX: 0.5 }));
  const cmdVelPayloadHigh = sqliteBlobLiteral(buildMinimalGeometryMsgsTwistStampedPayload({ linearX: 1.25 }));
  const tempPayload42 = sqliteBlobLiteral(buildMinimalStdMsgsFloat64Payload(42));
  const tempPayload43 = sqliteBlobLiteral(buildMinimalStdMsgsFloat64Payload(43));
  const tempPayload44 = sqliteBlobLiteral(buildMinimalStdMsgsFloat64Payload(44));

  return createRosbagDb(`
    INSERT INTO topics(id, name, type, serialization_format, offered_qos_profiles, type_description_hash)
      VALUES
        (1, '/odom', 'nav_msgs/msg/Odometry', 'cdr', '', 'hash-odom'),
        (2, '/fix', 'sensor_msgs/msg/NavSatFix', 'cdr', '', 'hash-fix'),
        (3, '/imu', 'sensor_msgs/msg/Imu', 'cdr', '', 'hash-imu'),
        (4, '/temperature', 'std_msgs/msg/Float64', 'cdr', '', 'hash-temp'),
        (5, '/cmd_vel', 'geometry_msgs/msg/TwistStamped', 'cdr', '', 'hash-cmd-vel');
    INSERT INTO messages(id, topic_id, timestamp, data)
      VALUES
        (1, 1, 1000000000, ${odomPayload}),
        (2, 1, 2000000000, ${odomPayload}),
        (3, 2, 2500000000, ${fixPayload}),
        (4, 1, 3000000000, ${odomPayload}),
        (5, 3, 1600000000, ${imuPayloadLow}),
        (6, 3, 2400000000, ${imuPayloadHigh}),
        (7, 4, 1500000000, ${tempPayload42}),
        (8, 4, 2200000000, ${tempPayload43}),
        (9, 4, 2800000000, ${tempPayload44}),
        (10, 5, 1700000000, ${cmdVelPayloadLow}),
        (11, 5, 2100000000, ${cmdVelPayloadHigh});
  `);
}

export async function createFindingsDemoDb() {
  const odomPayload = sqliteBlobLiteral(buildMinimalNavMsgsOdometryPayload());
  const fixPayload = sqliteBlobLiteral(buildMinimalSensorMsgsNavSatFixPayload());
  const scanPayload = sqliteBlobLiteral(buildMinimalSensorMsgsLaserScanPayload());
  const diagnosticsPayload = sqliteBlobLiteral(buildMinimalDiagnosticMsgsDiagnosticArrayPayload());

  return createRosbagDb(`
    INSERT INTO topics(id, name, type, serialization_format, offered_qos_profiles, type_description_hash)
      VALUES
        (1, '/diagnostics', 'diagnostic_msgs/msg/DiagnosticArray', 'cdr', '', 'hash-diagnostics'),
        (2, '/fix', 'sensor_msgs/msg/NavSatFix', 'cdr', '', 'hash-fix'),
        (3, '/odom', 'nav_msgs/msg/Odometry', 'cdr', '', 'hash-odom'),
        (4, '/scan', 'sensor_msgs/msg/LaserScan', 'cdr', '', 'hash-scan');
    INSERT INTO messages(id, topic_id, timestamp, data)
      VALUES
        (1, 3, 1000000000, ${odomPayload}),
        (2, 3, 2000000000, ${odomPayload}),
        (3, 2, 2500000000, ${fixPayload}),
        (4, 2, 3500000000, X'00'),
        (5, 4, 1000000000, ${scanPayload}),
        (6, 4, 7000000000, ${scanPayload}),
        (7, 1, 4000000000, ${diagnosticsPayload});
  `);
}
