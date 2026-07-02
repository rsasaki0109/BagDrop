import { describe, expect, it } from "vitest";
import { uint8ArrayToBase64 } from "../../platform/base64";
import { decodeStdMsgsFloat64, isCdrLittleEndian } from "./cdr";

describe("cdr", () => {
  it("decodes std_msgs/msg/Float64 payloads", () => {
    const payload = new Uint8Array([
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x45, 0x40
    ]);

    expect(isCdrLittleEndian(payload)).toBe(true);
    expect(decodeStdMsgsFloat64(payload)).toBe(42);
    expect(uint8ArrayToBase64(payload)).toBe("AAEAAAAAAAAAAAAAAABFQA==");
  });
});
