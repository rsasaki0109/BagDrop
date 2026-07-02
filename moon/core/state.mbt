///|
pub(all) struct TopicState {
  name : String
  type_name : String
  topic_id : Int
  catalog_count : Int?
  mut message_count : Int
  mut min_timestamp_ns : Int64?
  mut max_timestamp_ns : Int64?
  mut max_gap_ns : Int64?
  mut previous_timestamp_ns : Int64?
  mut payloads_decoded : Int
  mut decode_errors : Int
}

///|
pub(all) struct CoreState {
  mut topics : Map[String, TopicState]
  mut batches_consumed : Int
}

///|
pub fn CoreState::new() -> CoreState {
  { topics: {}, batches_consumed: 0 }
}

///|
pub fn CoreState::register_topic(
  self : CoreState,
  name : String,
  type_name : String,
  _serialization_format : String?,
  topic_id : Int,
  catalog_count : Int?,
) -> Unit {
  self.topics[name] = {
    name,
    type_name,
    topic_id,
    catalog_count,
    message_count: 0,
    min_timestamp_ns: None,
    max_timestamp_ns: None,
    max_gap_ns: None,
    previous_timestamp_ns: None,
    payloads_decoded: 0,
    decode_errors: 0,
  }
}

///|
pub fn CoreState::consume_timestamp(
  self : CoreState,
  topic_name : String,
  timestamp_ns : Int64,
) -> Unit {
  guard self.topics.get(topic_name) is Some(topic) else { return }
  topic.message_count = topic.message_count + 1
  topic.min_timestamp_ns = match topic.min_timestamp_ns {
    None => Some(timestamp_ns)
    Some(current) => Some(min_int64(current, timestamp_ns))
  }
  topic.max_timestamp_ns = match topic.max_timestamp_ns {
    None => Some(timestamp_ns)
    Some(current) => Some(max_int64(current, timestamp_ns))
  }
  match topic.previous_timestamp_ns {
    Some(previous) => {
      let gap = timestamp_ns - previous
      topic.max_gap_ns = match topic.max_gap_ns {
        None => Some(gap)
        Some(current) => Some(max_int64(current, gap))
      }
    }
    None => ()
  }
  topic.previous_timestamp_ns = Some(timestamp_ns)
}

///|
pub fn CoreState::consume_cdr_payload(
  self : CoreState,
  topic_name : String,
  payload : Bytes,
) -> Unit {
  guard self.topics.get(topic_name) is Some(topic) else { return }
  if validate_known_cdr_payload(topic.type_name, payload) {
    topic.payloads_decoded = topic.payloads_decoded + 1
  } else {
    topic.decode_errors = topic.decode_errors + 1
  }
}

///|
pub fn CoreState::mean_rate_hz(topic : TopicState) -> Double? {
  match (topic.min_timestamp_ns, topic.max_timestamp_ns) {
    (Some(start), Some(end)) if end > start => {
      let duration_seconds = (end - start).to_double() / 1_000_000_000.0
      if duration_seconds > 0.0 {
        Some(topic.message_count.to_double() / duration_seconds)
      } else {
        None
      }
    }
    _ => None
  }
}

fn min_int64(a : Int64, b : Int64) -> Int64 {
  if a < b {
    a
  } else {
    b
  }
}

fn max_int64(a : Int64, b : Int64) -> Int64 {
  if a > b {
    a
  } else {
    b
  }
}
