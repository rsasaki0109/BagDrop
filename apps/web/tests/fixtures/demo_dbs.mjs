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
  const tempPayload42 = sqliteBlobLiteral(buildMinimalStdMsgsFloat64Payload(42));
  const tempPayload43 = sqliteBlobLiteral(buildMinimalStdMsgsFloat64Payload(43));
  const tempPayload44 = sqliteBlobLiteral(buildMinimalStdMsgsFloat64Payload(44));

  return createRosbagDb(`
    INSERT INTO topics(id, name, type, serialization_format, offered_qos_profiles, type_description_hash)
      VALUES
        (1, '/odom', 'nav_msgs/msg/Odometry', 'cdr', '', 'hash-odom'),
        (2, '/fix', 'sensor_msgs/msg/NavSatFix', 'cdr', '', 'hash-fix'),
        (3, '/temperature', 'std_msgs/msg/Float64', 'cdr', '', 'hash-temp');
    INSERT INTO messages(id, topic_id, timestamp, data)
      VALUES
        (1, 1, 1000000000, ${odomPayload}),
        (2, 1, 2000000000, ${odomPayload}),
        (3, 2, 2500000000, ${fixPayload}),
        (4, 1, 3000000000, ${odomPayload}),
        (5, 3, 1500000000, ${tempPayload42}),
        (6, 3, 2200000000, ${tempPayload43}),
        (7, 3, 2800000000, ${tempPayload44});
  `);
}

export async function createFindingsDemoDb() {
  const odomPayload = sqliteBlobLiteral(buildMinimalNavMsgsOdometryPayload());
  const fixPayload = sqliteBlobLiteral(buildMinimalSensorMsgsNavSatFixPayload());

  return createRosbagDb(`
    INSERT INTO topics(id, name, type, serialization_format, offered_qos_profiles, type_description_hash)
      VALUES
        (1, '/fix', 'sensor_msgs/msg/NavSatFix', 'cdr', '', 'hash-fix'),
        (2, '/odom', 'nav_msgs/msg/Odometry', 'cdr', '', 'hash-odom'),
        (3, '/scan', 'sensor_msgs/msg/LaserScan', 'cdr', '', 'hash-scan');
    INSERT INTO messages(id, topic_id, timestamp, data)
      VALUES
        (1, 2, 1000000000, ${odomPayload}),
        (2, 2, 2000000000, ${odomPayload}),
        (3, 1, 2500000000, ${fixPayload}),
        (4, 1, 3500000000, X'00'),
        (5, 3, 1000000000, X'00'),
        (6, 3, 7000000000, X'00');
  `);
}
