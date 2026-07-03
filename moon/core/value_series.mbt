///|
pub(all) struct ValuePoint {
  timestamp_ns : Int64
  value : Double
}

///|
pub fn extract_primary_value(topic_type : String, payload : Bytes) -> Double? {
  match topic_type {
    "std_msgs/msg/Float64" => decode_std_msgs_float64(payload)
    "std_msgs/msg/Float32" =>
      match decode_std_msgs_float32(payload) {
        Some(value) => Some(value.to_double())
        None => None
      }
    "std_msgs/msg/Int32" =>
      match decode_std_msgs_int32(payload) {
        Some(value) => Some(value.to_double())
        None => None
      }
    "std_msgs/msg/UInt32" =>
      match decode_std_msgs_uint32(payload) {
        Some(value) => Some(value.to_double())
        None => None
      }
    "geometry_msgs/msg/TwistStamped" => decode_geometry_msgs_twist_stamped_linear_x(payload)
    "geometry_msgs/msg/TwistWithCovarianceStamped" =>
      decode_geometry_msgs_twist_with_covariance_stamped_linear_x(payload)
    _ => None
  }
}

///|
pub fn extract_angular_value(topic_type : String, payload : Bytes) -> Double? {
  match topic_type {
    "geometry_msgs/msg/TwistStamped" => decode_geometry_msgs_twist_stamped_angular_z(payload)
    "geometry_msgs/msg/TwistWithCovarianceStamped" =>
      decode_geometry_msgs_twist_with_covariance_stamped_angular_z(payload)
    _ => None
  }
}

///|
fn value_points_to_json(points : Array[ValuePoint]) -> Json {
  let values = []
  for point in points {
    values.push(
      Json::object({
        "timestampNs": Json::number(point.timestamp_ns.to_double()),
        "value": Json::number(point.value),
      }),
    )
  }
  Json::array(values)
}

///|
pub fn append_value_series_fields(
  fields : Map[String, Json],
  topic : TopicState,
) -> Map[String, Json] {
  if topic.value_series.length() > 0 {
    fields["valueSeries"] = value_points_to_json(topic.value_series)
  }
  if topic.angular_velocity_series.length() > 0 {
    fields["angularVelocitySeries"] = value_points_to_json(topic.angular_velocity_series)
  }
  fields
}
