import { describe, expect, it } from "vitest";
import {
  decodeMoonBitAnalysisResult,
  encodeTopicMessageBatch,
  decodeTopicMessageBatch
} from "./batch_codec";

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

describe("decodeMoonBitAnalysisResult", () => {
  it("parses optional value series fields on topics", () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        topics: [
          {
            name: "/cmd_vel",
            messageCount: 2,
            maxGapNs: 400_000_000,
            meanRateHz: 2.5,
            status: "ok",
            decodedPayloads: 2,
            decodeErrors: 0,
            valueSeries: [{ timestampNs: 1_000_000_000, value: 0.5 }],
            angularVelocitySeries: [{ timestampNs: 1_000_000_000, value: -0.2 }]
          }
        ],
        findings: [],
        batchesConsumed: 1
      })
    );

    expect(decodeMoonBitAnalysisResult(bytes)).toEqual({
      topics: [
        {
          name: "/cmd_vel",
          messageCount: 2,
          maxGapNs: 400_000_000,
          meanRateHz: 2.5,
          status: "ok",
          decodedPayloads: 2,
          decodeErrors: 0,
          valueSeries: [{ timestampNs: 1_000_000_000, value: 0.5 }],
          angularVelocitySeries: [{ timestampNs: 1_000_000_000, value: -0.2 }]
        }
      ],
      findings: [],
      batchesConsumed: 1
    });
  });
});
