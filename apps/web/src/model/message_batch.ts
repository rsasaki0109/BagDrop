export interface TopicMessageBatch {
  topicName: string;
  topicType: string;
  serializationFormat: string | null;
  timestampsNs: number[];
  payloadSizesBytes: number[];
}
