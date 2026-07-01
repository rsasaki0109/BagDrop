///|
const RESULT_OFFSET : Int = 65_536

///|
let core_state : Ref[@lib.CoreState?] = Ref(None)

///|
let result_len : Ref[Int] = Ref(0)

///|
/// Creates a new analysis session. Config payload is accepted for ABI compatibility.
pub fn core_create(_config_ptr : Int, _config_len : Int) -> Int {
  core_state.val = Some(@lib.CoreState::new())
  1
}

///|
pub fn core_register_topic(handle : Int, topic_ptr : Int, topic_len : Int) -> Int {
  guard handle == 1 && core_state.val is Some(state) else { return 1 }
  let payload = @lib.load_bytes(topic_ptr, topic_len)
  state.register_topic_json(payload)
}

///|
pub fn core_consume_batch(handle : Int, batch_ptr : Int, batch_len : Int) -> Int {
  guard handle == 1 && core_state.val is Some(state) else { return 1 }
  let payload = @lib.load_bytes(batch_ptr, batch_len)
  state.consume_batch_json(payload)
}

///|
pub fn core_finish(handle : Int) -> Int {
  guard handle == 1 && core_state.val is Some(state) else { return 0 }
  let json = state.to_result_json()
  let bytes = @lib.utf8_bytes(json)
  @lib.write_bytes(RESULT_OFFSET, bytes)
  result_len.val = bytes.length()
  1
}

///|
pub fn core_result_ptr(_result_handle : Int) -> Int {
  RESULT_OFFSET
}

///|
pub fn core_result_len(_result_handle : Int) -> Int {
  result_len.val
}

///|
pub fn core_free_result(_result_handle : Int) -> Unit {
  result_len.val = 0
}

///|
pub fn core_destroy(handle : Int) -> Unit {
  if handle == 1 {
    core_state.val = None
    result_len.val = 0
  }
}
