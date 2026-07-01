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
    "{\"v\":1,\"topicName\":\"/odom\",\"topicType\":\"nav_msgs/msg/Odometry\",\"serializationFormat\":\"cdr\",\"timestampsNs\":[1000000000,2000000000],\"payloadSizesBytes\":[1,1]}",
  )
  inspect(state.consume_batch_json(payload), content="0")
  inspect(state.batches_consumed, content="1")
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
      "{\"v\":1,\"topicName\":\"/odom\",\"topicType\":\"nav_msgs/msg/Odometry\",\"serializationFormat\":\"cdr\",\"timestampsNs\":[1000000000,2000000000],\"payloadSizesBytes\":[1,1]}",
    ),
  ))
  let result = state.to_result_json()
  assert_true(result.contains("stream-count-mismatch-0"))
  assert_true(result.contains("\"status\":\"error\""))
  assert_true(result.contains("\"catalogCount\":3"))
}
