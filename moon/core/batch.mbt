///|
pub fn CoreState::consume_batch_json(
  self : CoreState,
  payload : Bytes,
) -> Int {
  let text = try decode_utf8_payload(payload) catch {
    _ => return 1
  }
  let json = try @json.parse(text) catch {
    _ => return 1
  }
  guard json is Object(obj) else { return 1 }
  guard obj.get("topicName") is Some(String(topic_name)) else { return 1 }
  guard self.topics.get(topic_name) is Some(_) else { return 2 }
  guard obj.get("timestampsNs") is Some(Array(items)) else { return 1 }
  for item in items {
    guard item is Number(timestamp, ..) else { continue }
    self.consume_timestamp(topic_name, timestamp.to_int64())
  }
  match obj.get("payloadsBase64") {
    Some(Array(payload_items)) =>
      self.consume_payloads_base64(topic_name, items, payload_items)
    _ => ()
  }
  self.batches_consumed = self.batches_consumed + 1
  0
}

///|
fn CoreState::consume_payloads_base64(
  self : CoreState,
  topic_name : String,
  timestamps : Array[Json],
  payload_items : Array[Json],
) -> Unit {
  guard self.topics.get(topic_name) is Some(topic) else { return }
  if !has_cdr_decoder(topic.type_name) {
    return
  }
  let limit = min_int(timestamps.length(), payload_items.length())
  for index = 0; index < limit; index = index + 1 {
    guard timestamps[index] is Number(timestamp, ..) else { continue }
    guard payload_items[index] is String(base64) && base64.length() > 0 else { continue }
    let bytes = try @base64.decode(base64) catch {
      _ => {
        self.record_decode_error(topic_name)
        continue
      }
    }
    self.consume_cdr_payload(topic_name, timestamp.to_int64(), bytes)
  }
}

fn min_int(a : Int, b : Int) -> Int {
  if a < b {
    a
  } else {
    b
  }
}

///|
fn CoreState::record_decode_error(self : CoreState, topic_name : String) -> Unit {
  guard self.topics.get(topic_name) is Some(topic) else { return }
  topic.decode_errors = topic.decode_errors + 1
}

///|
pub fn CoreState::register_topic_json(self : CoreState, payload : Bytes) -> Int {
  let text = try decode_utf8_payload(payload) catch {
    _ => return 1
  }
  let json = try @json.parse(text) catch {
    _ => return 1
  }
  guard json is Object(obj) else { return 1 }
  guard obj.get("name") is Some(String(name)) else { return 1 }
  guard obj.get("type") is Some(String(topic_type)) else { return 1 }
  let serialization_format = match obj.get("serializationFormat") {
    Some(String(value)) if value.length() > 0 => Some(value)
    _ => None
  }
  let topic_id = match obj.get("catalogId") {
    Some(Number(value, ..)) => value.to_int()
    _ => 0
  }
  let catalog_count = match obj.get("catalogCount") {
    Some(Number(value, ..)) => Some(value.to_int())
    Some(Null) => None
    _ => None
  }
  self.register_topic(name, topic_type, serialization_format, topic_id, catalog_count)
  0
}
