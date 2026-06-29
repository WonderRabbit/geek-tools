#[derive(Debug)]
pub struct CoreError {
    code: &'static str,
    message: String,
}

impl CoreError {
    pub(crate) fn new(code: &'static str, message: &str) -> Self {
        Self {
            code,
            message: message.to_string(),
        }
    }

    pub(crate) const fn code(&self) -> &'static str {
        self.code
    }

    pub(crate) fn message(&self) -> &str {
        &self.message
    }
}

impl From<std::io::Error> for CoreError {
    fn from(source: std::io::Error) -> Self {
        Self::new("io_error", &source.to_string())
    }
}

impl From<crate::workspace::WorkspaceError> for CoreError {
    fn from(source: crate::workspace::WorkspaceError) -> Self {
        Self::new(source.code(), source.message())
    }
}
