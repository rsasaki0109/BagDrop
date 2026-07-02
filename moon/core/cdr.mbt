///|
pub fn is_cdr_le(payload : Bytes) -> Bool {
  payload.length() >= 4 &&
  payload.unsafe_get(0) == (0).to_byte() &&
  payload.unsafe_get(1) == (1).to_byte() &&
  payload.unsafe_get(2) == (0).to_byte() &&
  payload.unsafe_get(3) == (0).to_byte()
}

///|
fn load_u64_le(payload : Bytes, offset : Int) -> UInt64 {
  let mut value = 0UL
  for i = 0; i < 8; i = i + 1 {
    let byte_value = payload.unsafe_get(offset + i).to_int().to_uint64()
    value = value | (byte_value << (i * 8))
  }
  value
}

///|
pub fn decode_std_msgs_float64(payload : Bytes) -> Double? {
  if !is_cdr_le(payload) || payload.length() < 16 {
    return None
  }
  Some(load_u64_le(payload, 8).reinterpret_as_double())
}

///|
pub fn validate_known_cdr_payload(topic_type : String, payload : Bytes) -> Bool {
  match topic_type {
    "std_msgs/msg/Float64" => decode_std_msgs_float64(payload) is Some(_)
    _ => false
  }
}

///|
pub fn has_cdr_decoder(topic_type : String) -> Bool {
  topic_type == "std_msgs/msg/Float64"
}
