///|
const LARGE_GAP_WARNING_NS : Double = 5_000_000_000.0

///|
fn format_gap_seconds(gap_ns : Int) -> String {
  (gap_ns.to_double() / 1_000_000_000.0).to_string() + " s"
}

///|
fn topic_status(topic : TopicState) -> String {
  match topic.catalog_count {
    Some(expected) if expected != topic.message_count => "error"
    _ =>
      match topic.max_gap_ns {
        Some(gap) if gap.to_double() >= LARGE_GAP_WARNING_NS => "warning"
        _ => "ok"
      }
  }
}

///|
fn count_mismatch_finding(topic : TopicState, expected : Int) -> Json {
  Json::object({
    "id": Json::string("stream-count-mismatch-" + topic.topic_id.to_string()),
    "severity": Json::string("error"),
    "title": Json::string("Stream count mismatch"),
    "detail": Json::string(
      "Topic " + topic.name + " streamed " + topic.message_count.to_string() + " messages, but the catalog aggregate reported " + expected.to_string() + ".",
    ),
    "topic": Json::string(topic.name),
    "timeBasis": Json::string("record_time"),
    "evidence": Json::object({
      "streamedCount": Json::number(topic.message_count.to_double()),
      "catalogCount": Json::number(expected.to_double()),
    }),
  })
}

///|
fn large_gap_finding(topic : TopicState, gap_ns : Int) -> Json {
  Json::object({
    "id": Json::string("stream-large-gap-" + topic.topic_id.to_string()),
    "severity": Json::string("warning"),
    "title": Json::string("Large timestamp gap"),
    "detail": Json::string(
      "Topic " + topic.name + " has a maximum inter-message gap of " + format_gap_seconds(gap_ns) + ".",
    ),
    "topic": Json::string(topic.name),
    "timeBasis": Json::string("record_time"),
    "evidence": Json::object({
      "maxGapNs": Json::number(gap_ns.to_double()),
    }),
  })
}

///|
fn build_findings(topics : Map[String, TopicState]) -> Array[Json] {
  let findings = []
  for _, topic in topics {
    match topic.catalog_count {
      Some(expected) if expected != topic.message_count =>
        findings.push(count_mismatch_finding(topic, expected))
      _ =>
        match topic.max_gap_ns {
          Some(gap) if gap.to_double() >= LARGE_GAP_WARNING_NS =>
            findings.push(large_gap_finding(topic, gap))
          _ => ()
        }
    }
  }
  findings
}
