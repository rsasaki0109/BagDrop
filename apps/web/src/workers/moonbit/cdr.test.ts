import { describe, expect, it } from "vitest";
import { uint8ArrayToBase64 } from "../../platform/base64";
import {
  buildMinimalNavMsgsOdometryPayload,
  decodeStdMsgsFloat64,
  isCdrLittleEndian,
  validateKnownCdrPayload,
  validateNavMsgsOdometry
} from "./cdr";

describe("cdr", () => {
  it("decodes std_msgs/msg/Float64 payloads", () => {
    const payload = new Uint8Array([
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x45, 0x40
    ]);

    expect(isCdrLittleEndian(payload)).toBe(true);
    expect(decodeStdMsgsFloat64(payload)).toBe(42);
    expect(uint8ArrayToBase64(payload)).toBe("AAEAAAAAAAAAAAAAAABFQA==");
  });

  it("validates nav_msgs/msg/Odometry payloads", () => {
    const payload = buildMinimalNavMsgsOdometryPayload();

    expect(payload.length).toBe(712);
    expect(validateNavMsgsOdometry(payload)).toBe(true);
    expect(validateKnownCdrPayload("nav_msgs/msg/Odometry", payload)).toBe(true);
    expect(validateKnownCdrPayload("std_msgs/msg/Float64", payload)).toBe(false);
  });

  it("rejects truncated odometry payloads", () => {
    const payload = buildMinimalNavMsgsOdometryPayload().slice(0, 64);
    expect(validateNavMsgsOdometry(payload)).toBe(false);
  });
});
