import { existsSync } from "node:fs";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { chromium } from "playwright";
import { createServer } from "vite";

const chromeExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);

const server = await createServer({
  root: process.cwd(),
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: false,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    }
  }
});

await server.listen();

const baseUrl = new URL("bagdrop/", server.resolvedUrls?.local[0] ?? "http://127.0.0.1:5174/");
const browser = await chromium.launch({
  headless: true,
  executablePath: chromeExecutable
});

try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    throw error;
  });

  await page.goto(baseUrl.href);
  await page.setInputFiles("#file-input", {
    name: "segment_0.db3",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(await createRosbagLikeDb())
  });

  await page.getByRole("cell", { name: "/odom", exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("cell", { name: "nav_msgs/msg/Odometry", exact: true }).waitFor({ timeout: 15_000 });
  await page.locator(".metric-card").filter({ hasText: "Status" }).getByText("ready", { exact: true }).waitFor({
    timeout: 15_000
  });
} finally {
  await browser.close();
  await server.close();
}

async function createRosbagLikeDb() {
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
      INSERT INTO topics(id, name, type, serialization_format, offered_qos_profiles, type_description_hash)
        VALUES
          (1, '/odom', 'nav_msgs/msg/Odometry', 'cdr', '', 'hash-odom'),
          (2, '/fix', 'sensor_msgs/msg/NavSatFix', 'cdr', '', 'hash-fix');
      INSERT INTO messages(id, topic_id, timestamp, data)
        VALUES
          (1, 1, 1000000000, X'00'),
          (2, 1, 2000000000, X'00'),
          (3, 2, 2500000000, X'00'),
          (4, 1, 3000000000, X'00');
    `);

    return sqlite3.capi.sqlite3_js_db_export(db);
  } finally {
    db.close();
  }
}
