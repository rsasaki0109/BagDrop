///|
test "decode std_msgs float64 payload" {
  let payload = @base64.decode("AAEAAAAAAAAAAAAAAABFQA==")
  inspect(decode_std_msgs_float64(payload), content="Some(42)")
}

///|
test "reject invalid cdr payload" {
  let payload = b"\x00\x00\x00\x00"
  inspect(validate_known_cdr_payload("std_msgs/msg/Float64", payload), content="false")
}

///|
test "register topic json accepts utf8 bytes payload" {
  let state = CoreState::new()
  let payload = @utf8.encode(
    "{\"v\":1,\"catalogId\":0,\"name\":\"/odom\",\"type\":\"nav_msgs/msg/Odometry\",\"serializationFormat\":\"cdr\",\"catalogCount\":3}",
  )
  inspect(state.register_topic_json(payload), content="0")
}

///|
test "consume batch json accepts utf8 bytes payload" {
  let state = CoreState::new()
  ignore(state.register_topic_json(
    @utf8.encode(
      "{\"v\":1,\"catalogId\":0,\"name\":\"/odom\",\"type\":\"nav_msgs/msg/Odometry\",\"serializationFormat\":\"cdr\",\"catalogCount\":2}",
    ),
  ))
  let payload = @utf8.encode(
    "{\"v\":1,\"topicName\":\"/odom\",\"topicType\":\"nav_msgs/msg/Odometry\",\"serializationFormat\":\"cdr\",\"timestampsNs\":[1000000000,2000000000],\"payloadSizesBytes\":[1,1],\"payloadsBase64\":[]}",
  )
  inspect(state.consume_batch_json(payload), content="0")
  inspect(state.batches_consumed, content="1")
}

///|
test "consume batch decodes std_msgs float64 payloads" {
  let state = CoreState::new()
  ignore(state.register_topic_json(
    @utf8.encode(
      "{\"v\":1,\"catalogId\":1,\"name\":\"/temperature\",\"type\":\"std_msgs/msg/Float64\",\"serializationFormat\":\"cdr\",\"catalogCount\":1}",
    ),
  ))
  let payload = @utf8.encode(
    "{\"v\":1,\"topicName\":\"/temperature\",\"topicType\":\"std_msgs/msg/Float64\",\"serializationFormat\":\"cdr\",\"timestampsNs\":[1000000000],\"payloadSizesBytes\":[16],\"payloadsBase64\":[\"AAEAAAAAAAAAAAAAAABFQA==\"]}",
  )
  inspect(state.consume_batch_json(payload), content="0")
  guard state.topics.get("/temperature") is Some(topic) else {
    fail("topic missing")
  }
  inspect(topic.payloads_decoded, content="1")
  inspect(topic.decode_errors, content="0")
}

///|
test "consume batch decodes nav_msgs odometry payloads" {
  let state = CoreState::new()
  ignore(state.register_topic_json(
    @utf8.encode(
      "{\"v\":1,\"catalogId\":0,\"name\":\"/odom\",\"type\":\"nav_msgs/msg/Odometry\",\"serializationFormat\":\"cdr\",\"catalogCount\":1}",
    ),
  ))
  let payload = @utf8.encode(
    "{\"v\":1,\"topicName\":\"/odom\",\"topicType\":\"nav_msgs/msg/Odometry\",\"serializationFormat\":\"cdr\",\"timestampsNs\":[1000000000],\"payloadSizesBytes\":[712],\"payloadsBase64\":[\"AAEAAAAAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==\"]}",
  )
  inspect(state.consume_batch_json(payload), content="0")
  guard state.topics.get("/odom") is Some(topic) else {
    fail("topic missing")
  }
  inspect(topic.payloads_decoded, content="1")
  inspect(topic.decode_errors, content="0")
}

///|
test "consume batch decodes sensor_msgs navsatfix payloads" {
  let state = CoreState::new()
  ignore(state.register_topic_json(
    @utf8.encode(
      "{\"v\":1,\"catalogId\":0,\"name\":\"/fix\",\"type\":\"sensor_msgs/msg/NavSatFix\",\"serializationFormat\":\"cdr\",\"catalogCount\":1}",
    ),
  ))
  let payload = @utf8.encode(
    "{\"v\":1,\"topicName\":\"/fix\",\"topicType\":\"sensor_msgs/msg/NavSatFix\",\"serializationFormat\":\"cdr\",\"timestampsNs\":[1000000000],\"payloadSizesBytes\":[121],\"payloadsBase64\":[\"AAEAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==\"]}",
  )
  inspect(state.consume_batch_json(payload), content="0")
  guard state.topics.get("/fix") is Some(topic) else {
    fail("topic missing")
  }
  inspect(topic.payloads_decoded, content="1")
  inspect(topic.decode_errors, content="0")
}

///|
test "finish writes result json and count mismatch finding" {
  let state = CoreState::new()
  ignore(state.register_topic_json(
    @utf8.encode(
      "{\"v\":1,\"catalogId\":0,\"name\":\"/odom\",\"type\":\"nav_msgs/msg/Odometry\",\"serializationFormat\":\"cdr\",\"catalogCount\":3}",
    ),
  ))
  ignore(state.consume_batch_json(
    @utf8.encode(
      "{\"v\":1,\"topicName\":\"/odom\",\"topicType\":\"nav_msgs/msg/Odometry\",\"serializationFormat\":\"cdr\",\"timestampsNs\":[1000000000,2000000000],\"payloadSizesBytes\":[1,1],\"payloadsBase64\":[]}",
    ),
  ))
  let result = state.to_result_json()
  assert_true(result.contains("stream-count-mismatch-0"))
  assert_true(result.contains("\"status\":\"error\""))
  assert_true(result.contains("\"catalogCount\":3"))
}

///|
test "finish emits large gap warning for int64 timestamps" {
  let state = CoreState::new()
  ignore(state.register_topic_json(
    @utf8.encode(
      "{\"v\":1,\"catalogId\":2,\"name\":\"/scan\",\"type\":\"sensor_msgs/msg/LaserScan\",\"serializationFormat\":\"cdr\",\"catalogCount\":2}",
    ),
  ))
  ignore(state.consume_batch_json(
    @utf8.encode(
      "{\"v\":1,\"topicName\":\"/scan\",\"topicType\":\"sensor_msgs/msg/LaserScan\",\"serializationFormat\":\"cdr\",\"timestampsNs\":[0,6000000000],\"payloadSizesBytes\":[1,1],\"payloadsBase64\":[]}",
    ),
  ))
  let result = state.to_result_json()
  assert_true(result.contains("stream-large-gap-2"))
  assert_true(result.contains("\"status\":\"warning\""))
  assert_true(result.contains("\"maxGapNs\":6000000000"))
}

///|
test "consume batch preserves timestamps beyond int32 range" {
  let state = CoreState::new()
  ignore(state.register_topic_json(
    @utf8.encode(
      "{\"v\":1,\"catalogId\":3,\"name\":\"/wide\",\"type\":\"std_msgs/msg/Float64\",\"serializationFormat\":\"cdr\",\"catalogCount\":2}",
    ),
  ))
  ignore(state.consume_batch_json(
    @utf8.encode(
      "{\"v\":1,\"topicName\":\"/wide\",\"topicType\":\"std_msgs/msg/Float64\",\"serializationFormat\":\"cdr\",\"timestampsNs\":[3000000000,9000000000000],\"payloadSizesBytes\":[1,1],\"payloadsBase64\":[]}",
    ),
  ))
  guard state.topics.get("/wide") is Some(topic) else {
    fail("topic missing")
  }
  inspect(topic.max_gap_ns, content="Some(8997000000000)")
}
