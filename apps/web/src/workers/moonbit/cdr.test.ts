import { describe, expect, it } from "vitest";
import { uint8ArrayToBase64 } from "../../platform/base64";
import {
  buildMinimalNavMsgsOdometryPayload,
  buildMinimalSensorMsgsImuPayload,
  buildMinimalSensorMsgsNavSatFixPayload,
  buildMinimalStdMsgsFloat64Payload,
  decodeNavMsgsOdometryXY,
  decodeSensorMsgsNavSatFixLatLon,
  decodeStdMsgsFloat64,
  isCdrLittleEndian,
  validateKnownCdrPayload,
  validateNavMsgsOdometry,
  validateSensorMsgsImu,
  validateSensorMsgsNavSatFix
} from "./cdr";

describe("cdr", () => {
  it("decodes std_msgs/msg/Float64 payloads", () => {
    const payload = buildMinimalStdMsgsFloat64Payload(42);

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

  it("decodes nav_msgs/msg/Odometry pose x/y", () => {
    const payload = buildMinimalNavMsgsOdometryPayload({ x: 3.5, y: -1.25, z: 0.5 });

    expect(decodeNavMsgsOdometryXY(payload)).toEqual({ x: 3.5, y: -1.25 });
  });

  it("rejects truncated odometry payloads", () => {
    const payload = buildMinimalNavMsgsOdometryPayload().slice(0, 64);
    expect(validateNavMsgsOdometry(payload)).toBe(false);
  });

  it("validates sensor_msgs/msg/NavSatFix payloads", () => {
    const payload = buildMinimalSensorMsgsNavSatFixPayload();

    expect(payload.length).toBe(121);
    expect(validateSensorMsgsNavSatFix(payload)).toBe(true);
    expect(validateKnownCdrPayload("sensor_msgs/msg/NavSatFix", payload)).toBe(true);
    expect(uint8ArrayToBase64(payload)).toBe(
      "AAEAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
    );
  });

  it("decodes sensor_msgs/msg/NavSatFix latitude and longitude", () => {
    const payload = buildMinimalSensorMsgsNavSatFixPayload({ lat: 35.6812, lon: 139.7671, alt: 12.3 });

    expect(decodeSensorMsgsNavSatFixLatLon(payload)).toEqual({ lat: 35.6812, lon: 139.7671 });
  });

  it("validates sensor_msgs/msg/Imu payloads", () => {
    const payload = buildMinimalSensorMsgsImuPayload({ wx: 0.1, wy: -0.2, wz: 0.3, ax: 1, ay: 2, az: 9.8 });

    expect(payload.length).toBe(320);
    expect(validateSensorMsgsImu(payload)).toBe(true);
    expect(validateKnownCdrPayload("sensor_msgs/msg/Imu", payload)).toBe(true);
    expect(validateKnownCdrPayload("sensor_msgs/msg/NavSatFix", payload)).toBe(false);
    expect(uint8ArrayToBase64(buildMinimalSensorMsgsImuPayload())).toBe(
      "AAEAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    );
  });

  it("rejects truncated imu payloads", () => {
    const payload = buildMinimalSensorMsgsImuPayload().slice(0, 128);
    expect(validateSensorMsgsImu(payload)).toBe(false);
  });
});
