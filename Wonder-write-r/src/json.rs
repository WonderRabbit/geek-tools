use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JsonValue {
    Bool(bool),
    Number(u64),
    String(String),
    Array(Vec<JsonValue>),
    Object(BTreeMap<String, JsonValue>),
}

pub fn stringify(value: &JsonValue) -> String {
    match value {
        JsonValue::Bool(item) => item.to_string(),
        JsonValue::Number(item) => item.to_string(),
        JsonValue::String(item) => quote(item),
        JsonValue::Array(items) => {
            let body = items.iter().map(stringify).collect::<Vec<_>>().join(",");
            format!("[{body}]")
        }
        JsonValue::Object(items) => {
            let body = items
                .iter()
                .map(|(key, value)| format!("{}:{}", quote(key), stringify(value)))
                .collect::<Vec<_>>()
                .join(",");
            format!("{{{body}}}")
        }
    }
}

pub fn quote(input: &str) -> String {
    let mut output = String::with_capacity(input.len() + 2);
    output.push('"');
    for item in input.chars() {
        match item {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            value if value.is_control() => {
                output.push_str(&format!("\\u{:04x}", u32::from(value)));
            }
            value => output.push(value),
        }
    }
    output.push('"');
    output
}

pub fn flat_string_map(input: &str) -> Result<BTreeMap<String, String>, String> {
    let mut parser = Parser::new(input);
    parser.object()
}

struct Parser<'a> {
    input: &'a str,
    position: usize,
}

impl<'a> Parser<'a> {
    const fn new(input: &'a str) -> Self {
        Self { input, position: 0 }
    }

    fn object(&mut self) -> Result<BTreeMap<String, String>, String> {
        self.ws();
        self.byte(b'{')?;
        let mut output = BTreeMap::new();
        loop {
            self.ws();
            if self.peek_byte() == Some(b'}') {
                self.position += 1;
                self.ws();
                if self.position != self.input.len() {
                    return Err("unexpected trailing characters".to_string());
                }
                return Ok(output);
            }
            let key = self.string()?;
            self.ws();
            self.byte(b':')?;
            self.ws();
            let value = self.string()?;
            output.insert(key, value);
            self.ws();
            match self.peek_byte() {
                Some(b',') => self.position += 1,
                Some(b'}') => continue,
                _ => return Err("expected comma or object end".to_string()),
            }
        }
    }

    fn string(&mut self) -> Result<String, String> {
        self.byte(b'"')?;
        let mut output = String::new();
        while let Some(value) = self.peek_byte() {
            match value {
                b'"' => {
                    self.position += 1;
                    return Ok(output);
                }
                b'\\' => {
                    self.position += 1;
                    output.push(self.escape()?);
                }
                _ => {
                    let item = self.next_char()?;
                    output.push(item);
                }
            }
        }
        Err("unterminated string".to_string())
    }

    fn escape(&mut self) -> Result<char, String> {
        let Some(value) = self.peek_byte() else {
            return Err("unterminated escape".to_string());
        };
        self.position += 1;
        match value {
            b'"' => Ok('"'),
            b'\\' => Ok('\\'),
            b'/' => Ok('/'),
            b'n' => Ok('\n'),
            b'r' => Ok('\r'),
            b't' => Ok('\t'),
            b'u' => self.unicode_escape(),
            _ => Err("unsupported escape in string map".to_string()),
        }
    }

    fn unicode_escape(&mut self) -> Result<char, String> {
        let first = self.hex_quad()?;
        if (0xd800..=0xdbff).contains(&first) {
            self.byte(b'\\')?;
            self.byte(b'u')?;
            let second = self.hex_quad()?;
            if !(0xdc00..=0xdfff).contains(&second) {
                return Err("invalid unicode surrogate pair".to_string());
            }
            let scalar = 0x10000 + (((first - 0xd800) << 10) | (second - 0xdc00));
            return char::from_u32(scalar).ok_or_else(|| "invalid unicode scalar".to_string());
        }
        char::from_u32(first).ok_or_else(|| "invalid unicode scalar".to_string())
    }

    fn hex_quad(&mut self) -> Result<u32, String> {
        let mut value = 0_u32;
        for _ in 0..4 {
            let Some(byte) = self.peek_byte() else {
                return Err("incomplete unicode escape".to_string());
            };
            self.position += 1;
            value = (value << 4)
                | match byte {
                    b'0'..=b'9' => u32::from(byte - b'0'),
                    b'a'..=b'f' => u32::from(byte - b'a' + 10),
                    b'A'..=b'F' => u32::from(byte - b'A' + 10),
                    _ => return Err("invalid unicode escape digit".to_string()),
                };
        }
        Ok(value)
    }

    fn byte(&mut self, expected: u8) -> Result<(), String> {
        if self.peek_byte() == Some(expected) {
            self.position += 1;
            Ok(())
        } else {
            Err(format!("expected byte {}", char::from(expected)))
        }
    }

    fn ws(&mut self) {
        while matches!(self.peek_byte(), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            self.position += 1;
        }
    }

    fn peek_byte(&self) -> Option<u8> {
        self.input.as_bytes().get(self.position).copied()
    }

    fn next_char(&mut self) -> Result<char, String> {
        let Some(item) = self.input[self.position..].chars().next() else {
            return Err("unexpected end of string".to_string());
        };
        self.position += item.len_utf8();
        Ok(item)
    }
}

#[cfg(test)]
mod tests {
    use super::flat_string_map;

    #[test]
    fn flat_string_map_accepts_utf8_and_unicode_escapes() {
        let parsed = flat_string_map(r#"{"문서.txt":"abc","\u0064\u006f\u0063":"def"}"#).unwrap();

        assert_eq!(parsed.get("문서.txt").unwrap(), "abc");
        assert_eq!(parsed.get("doc").unwrap(), "def");
    }
}
