///|
pub fn is_cdr_le(payload : Bytes) -> Bool {
  payload.length() >= 4 &&
  payload.unsafe_get(0) == (0).to_byte() &&
  payload.unsafe_get(1) == (1).to_byte() &&
  payload.unsafe_get(2) == (0).to_byte() &&
  payload.unsafe_get(3) == (0).to_byte()
}

///|
fn load_u32_le(payload : Bytes, offset : Int) -> UInt {
  let mut value = 0U
  for i = 0; i < 4; i = i + 1 {
    let byte_value = payload.unsafe_get(offset + i).to_int().to_uint()
    value = value | (byte_value << (i * 8))
  }
  value
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
struct CdrReader {
  payload : Bytes
  mut offset : Int
}

///|
fn CdrReader::new(payload : Bytes) -> CdrReader {
  { payload, offset: 0 }
}

///|
fn CdrReader::can_read(self : CdrReader, bytes : Int) -> Bool {
  self.offset + bytes <= self.payload.length()
}

///|
fn CdrReader::align(self : CdrReader, alignment : Int) -> Bool {
  let remainder = self.offset % alignment
  if remainder != 0 {
    self.offset = self.offset + alignment - remainder
  }
  self.offset <= self.payload.length()
}

///|
fn CdrReader::skip_encapsulation(self : CdrReader) -> Bool {
  if !self.can_read(4) {
    return false
  }
  self.offset = self.offset + 4
  true
}

///|
fn CdrReader::skip_header_stamp(self : CdrReader) -> Bool {
  if !self.can_read(8) {
    return false
  }
  self.offset = self.offset + 8
  true
}

///|
fn CdrReader::skip_string(self : CdrReader) -> Bool {
  if !self.align(4) || !self.can_read(4) {
    return false
  }
  let length = load_u32_le(self.payload, self.offset).to_int()
  self.offset = self.offset + 4
  if length <= 0 || !self.can_read(length) {
    return false
  }
  self.offset = self.offset + length
  let padding = (4 - (length % 4)) % 4
  if !self.can_read(padding) {
    return false
  }
  self.offset = self.offset + padding
  true
}

///|
fn CdrReader::skip_doubles(self : CdrReader, count : Int) -> Bool {
  if !self.align(8) {
    return false
  }
  let bytes = count * 8
  if !self.can_read(bytes) {
    return false
  }
  self.offset = self.offset + bytes
  true
}

///|
fn CdrReader::skip_u8(self : CdrReader) -> Bool {
  if !self.can_read(1) {
    return false
  }
  self.offset = self.offset + 1
  true
}

///|
fn CdrReader::skip_u16(self : CdrReader) -> Bool {
  if !self.align(2) || !self.can_read(2) {
    return false
  }
  self.offset = self.offset + 2
  true
}

///|
fn CdrReader::consumed_entire_payload(self : CdrReader) -> Bool {
  self.offset == self.payload.length()
}

///|
pub fn decode_std_msgs_int32(payload : Bytes) -> Int? {
  if !is_cdr_le(payload) || payload.length() != 8 {
    return None
  }
  Some(load_u32_le(payload, 4).reinterpret_as_int())
}

///|
pub fn decode_std_msgs_uint32(payload : Bytes) -> UInt? {
  if !is_cdr_le(payload) || payload.length() != 8 {
    return None
  }
  Some(load_u32_le(payload, 4))
}

///|
pub fn decode_std_msgs_float32(payload : Bytes) -> Float? {
  if !is_cdr_le(payload) || payload.length() != 8 {
    return None
  }
  Some(load_u32_le(payload, 4).reinterpret_as_float())
}

///|
pub fn decode_std_msgs_float64(payload : Bytes) -> Double? {
  if !is_cdr_le(payload) || payload.length() != 16 {
    return None
  }
  Some(load_u64_le(payload, 8).reinterpret_as_double())
}

///|
pub fn validate_geometry_msgs_pose_with_covariance_stamped(payload : Bytes) -> Bool {
  if !is_cdr_le(payload) {
    return false
  }
  let reader = CdrReader::new(payload)
  reader.skip_encapsulation() &&
  reader.skip_header_stamp() &&
  reader.skip_string() &&
  reader.skip_doubles(43) &&
  reader.consumed_entire_payload()
}

///|
pub fn validate_geometry_msgs_pose_stamped(payload : Bytes) -> Bool {
  if !is_cdr_le(payload) {
    return false
  }
  let reader = CdrReader::new(payload)
  reader.skip_encapsulation() &&
  reader.skip_header_stamp() &&
  reader.skip_string() &&
  reader.skip_doubles(7) &&
  reader.consumed_entire_payload()
}

///|
pub fn validate_nav_msgs_odometry(payload : Bytes) -> Bool {
  if !is_cdr_le(payload) {
    return false
  }
  let reader = CdrReader::new(payload)
  reader.skip_encapsulation() &&
  reader.skip_header_stamp() &&
  reader.skip_string() &&
  reader.skip_string() &&
  reader.skip_doubles(7) &&
  reader.skip_doubles(36) &&
  reader.skip_doubles(6) &&
  reader.skip_doubles(36)
}

///|
pub fn validate_sensor_msgs_nav_sat_fix(payload : Bytes) -> Bool {
  if !is_cdr_le(payload) {
    return false
  }
  let reader = CdrReader::new(payload)
  reader.skip_encapsulation() &&
  reader.skip_header_stamp() &&
  reader.skip_string() &&
  reader.skip_u8() &&
  reader.skip_u16() &&
  reader.skip_doubles(3) &&
  reader.skip_doubles(9) &&
  reader.skip_u8() &&
  reader.consumed_entire_payload()
}

///|
pub fn validate_sensor_msgs_imu(payload : Bytes) -> Bool {
  if !is_cdr_le(payload) {
    return false
  }
  let reader = CdrReader::new(payload)
  reader.skip_encapsulation() &&
  reader.skip_header_stamp() &&
  reader.skip_string() &&
  reader.skip_doubles(4) &&
  reader.skip_doubles(9) &&
  reader.skip_doubles(3) &&
  reader.skip_doubles(9) &&
  reader.skip_doubles(3) &&
  reader.skip_doubles(9) &&
  reader.consumed_entire_payload()
}

///|
pub fn validate_known_cdr_payload(topic_type : String, payload : Bytes) -> Bool {
  match topic_type {
    "std_msgs/msg/Float32" => decode_std_msgs_float32(payload) is Some(_)
    "std_msgs/msg/Float64" => decode_std_msgs_float64(payload) is Some(_)
    "std_msgs/msg/Int32" => decode_std_msgs_int32(payload) is Some(_)
    "std_msgs/msg/UInt32" => decode_std_msgs_uint32(payload) is Some(_)
    "geometry_msgs/msg/PoseStamped" => validate_geometry_msgs_pose_stamped(payload)
    "geometry_msgs/msg/PoseWithCovarianceStamped" => validate_geometry_msgs_pose_with_covariance_stamped(payload)
    "nav_msgs/msg/Odometry" => validate_nav_msgs_odometry(payload)
    "sensor_msgs/msg/NavSatFix" => validate_sensor_msgs_nav_sat_fix(payload)
    "sensor_msgs/msg/Imu" => validate_sensor_msgs_imu(payload)
    _ => false
  }
}

///|
pub fn has_cdr_decoder(topic_type : String) -> Bool {
  topic_type == "std_msgs/msg/Float32" ||
  topic_type == "std_msgs/msg/Float64" ||
  topic_type == "std_msgs/msg/Int32" ||
  topic_type == "std_msgs/msg/UInt32" ||
  topic_type == "geometry_msgs/msg/PoseStamped" ||
  topic_type == "geometry_msgs/msg/PoseWithCovarianceStamped" ||
  topic_type == "nav_msgs/msg/Odometry" ||
  topic_type == "sensor_msgs/msg/NavSatFix" ||
  topic_type == "sensor_msgs/msg/Imu"
}
