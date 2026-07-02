# Supported Types

BagDrop currently decodes CDR payloads for:

- `std_msgs/msg/Float64`
- `nav_msgs/msg/Odometry`
- `sensor_msgs/msg/NavSatFix`

Other types still pass through stream analysis with timestamp statistics only. The initial generated decoder target list is:

- `geometry_msgs/msg/PoseStamped`
- `geometry_msgs/msg/PoseWithCovarianceStamped`
- `geometry_msgs/msg/TwistStamped`
- `geometry_msgs/msg/TwistWithCovarianceStamped`
- `nav_msgs/msg/Odometry`
- `nav_msgs/msg/Path`
- `sensor_msgs/msg/NavSatFix`
- `sensor_msgs/msg/Imu`
- `diagnostic_msgs/msg/DiagnosticArray`
- `std_msgs/msg/Float32`
- `std_msgs/msg/Float64`
- `std_msgs/msg/Int32`
- `std_msgs/msg/UInt32`

`sensor_msgs/msg/NavSatFix` does not contain satellite count. Satellite count must come from adapters such as `gps_msgs/GPSStatus`, `gps_msgs/GPSFix`, vendor-specific messages, or user-defined field mappings. Missing satellite-count topics must be reported as `N/A`, not `0`.
