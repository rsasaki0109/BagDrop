///|
extern "wasm" fn load_u8(ptr : Int) -> Int =
  #|(func (param i32) (result i32) (i32.load8_u (local.get 0)))

///|
extern "wasm" fn store_u8(ptr : Int, value : Int) -> Unit =
  #|(func (param i32 i32) (i32.store8 (local.get 0) (local.get 1)))

///|
pub fn load_bytes(ptr : Int, len : Int) -> Bytes {
  if len <= 0 {
    return b""
  }
  Bytes::makei(len, fn(i) { load_u8(ptr + i).to_byte() })
}

///|
pub fn write_bytes(ptr : Int, bytes : Bytes) -> Unit {
  for i = 0; i < bytes.length(); i = i + 1 {
    store_u8(ptr + i, bytes.unsafe_get(i).to_int())
  }
}

///|
pub fn utf8_bytes(text : String) -> Bytes {
  @utf8.encode(text)
}

///|
fn decode_utf8_payload(payload : Bytes) -> String raise {
  @utf8.decode(payload)
}
