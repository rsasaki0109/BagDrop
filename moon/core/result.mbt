///|
pub fn CoreState::to_result_json(self : CoreState) -> String {
  let topic_values = []
  for _, topic in self.topics {
    topic_values.push(Json::object({
      "name": Json::string(topic.name),
      "messageCount": Json::number(topic.message_count.to_double()),
      "maxGapNs": match topic.max_gap_ns {
        Some(gap) => Json::number(gap.to_double())
        None => Json::null()
      },
      "meanRateHz": match CoreState::mean_rate_hz(topic) {
        Some(rate) => Json::number(rate)
        None => Json::null()
      },
      "status": Json::string(topic_status(topic)),
    }))
  }
  Json::object({
    "v": Json::number(1.0),
    "topics": Json::array(topic_values),
    "findings": Json::array(build_findings(self.topics)),
    "batchesConsumed": Json::number(self.batches_consumed.to_double()),
  }).stringify()
}
