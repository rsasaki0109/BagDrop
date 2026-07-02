import { describe, expect, it } from "vitest";
import { encodeTopicMessageBatch, decodeTopicMessageBatch } from "./batch_codec";

describe("encodeTopicMessageBatch", () => {
  it("round-trips batch payloads as utf-8 json", () => {
    const batch = {
      topicName: "/odom",
      topicType: "nav_msgs/msg/Odometry",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000, 2_000_000_000],
      payloadSizesBytes: [1, 1],
      payloadsBase64: ["", ""]
    };

    expect(decodeTopicMessageBatch(encodeTopicMessageBatch(batch))).toEqual(batch);
  });
});
