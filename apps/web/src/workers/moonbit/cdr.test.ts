import { describe, expect, it } from "vitest";
import { uint8ArrayToBase64 } from "../../platform/base64";
import {
  buildMinimalGeometryMsgsPoseStampedPayload,
  buildMinimalGeometryMsgsPoseWithCovarianceStampedPayload,
  buildMinimalNavMsgsOdometryPayload,
  buildMinimalSensorMsgsImuPayload,
  buildMinimalSensorMsgsNavSatFixPayload,
  buildMinimalStdMsgsFloat32Payload,
  buildMinimalStdMsgsFloat64Payload,
  buildMinimalStdMsgsInt32Payload,
  buildMinimalStdMsgsUInt32Payload,
  decodeGeometryMsgsPoseStampedXY,
  decodeGeometryMsgsPoseWithCovarianceStampedXY,
  decodeNavMsgsOdometryXY,
  decodeSensorMsgsNavSatFixLatLon,
  decodeStdMsgsFloat32,
  decodeStdMsgsFloat64,
  decodeStdMsgsInt32,
  decodeStdMsgsUInt32,
  isCdrLittleEndian,
  validateGeometryMsgsPoseStamped,
  validateGeometryMsgsPoseWithCovarianceStamped,
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

  it("decodes std_msgs/msg/Float32 payloads", () => {
    const payload = buildMinimalStdMsgsFloat32Payload(42);

    expect(payload.length).toBe(8);
    expect(decodeStdMsgsFloat32(payload)).toBeCloseTo(42);
    expect(validateKnownCdrPayload("std_msgs/msg/Float32", payload)).toBe(true);
    expect(validateKnownCdrPayload("std_msgs/msg/Float64", payload)).toBe(false);
  });

  it("decodes std_msgs/msg/Int32 and UInt32 payloads", () => {
    const intPayload = buildMinimalStdMsgsInt32Payload(-7);
    const uintPayload = buildMinimalStdMsgsUInt32Payload(42);

    expect(decodeStdMsgsInt32(intPayload)).toBe(-7);
    expect(decodeStdMsgsUInt32(uintPayload)).toBe(42);
    expect(validateKnownCdrPayload("std_msgs/msg/Int32", intPayload)).toBe(true);
    expect(validateKnownCdrPayload("std_msgs/msg/UInt32", uintPayload)).toBe(true);
  });

  it("validates geometry_msgs/msg/PoseStamped payloads", () => {
    const payload = buildMinimalGeometryMsgsPoseStampedPayload();

    expect(payload.length).toBe(80);
    expect(validateGeometryMsgsPoseStamped(payload)).toBe(true);
    expect(validateKnownCdrPayload("geometry_msgs/msg/PoseStamped", payload)).toBe(true);
    expect(validateKnownCdrPayload("nav_msgs/msg/Odometry", payload)).toBe(false);
  });

  it("decodes geometry_msgs/msg/PoseStamped pose x/y", () => {
    const payload = buildMinimalGeometryMsgsPoseStampedPayload({ x: 4.5, y: -2, z: 0.25 });

    expect(decodeGeometryMsgsPoseStampedXY(payload)).toEqual({ x: 4.5, y: -2 });
  });

  it("validates geometry_msgs/msg/PoseWithCovarianceStamped payloads", () => {
    const payload = buildMinimalGeometryMsgsPoseWithCovarianceStampedPayload();

    expect(payload.length).toBe(368);
    expect(validateGeometryMsgsPoseWithCovarianceStamped(payload)).toBe(true);
    expect(validateKnownCdrPayload("geometry_msgs/msg/PoseWithCovarianceStamped", payload)).toBe(true);
  });

  it("decodes geometry_msgs/msg/PoseWithCovarianceStamped pose x/y", () => {
    const payload = buildMinimalGeometryMsgsPoseWithCovarianceStampedPayload({ x: 1.25, y: 3.5 });

    expect(decodeGeometryMsgsPoseWithCovarianceStampedXY(payload)).toEqual({ x: 1.25, y: 3.5 });
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
