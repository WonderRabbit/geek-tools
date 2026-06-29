use crate::core;
use crate::json;
use std::collections::BTreeMap;
use std::ffi::OsString;
use std::fs;
use std::path::PathBuf;

pub fn run<I>(args: I, cwd: Result<PathBuf, std::io::Error>) -> Result<i32, CliError>
where
    I: Iterator<Item = String>,
{
    let parsed = Args::parse(args)?;
    if parsed.help || parsed.command.is_none() {
        println!("{}", help());
        return Ok(0);
    }
    let root = parsed
        .root
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or(cwd.map_err(CliError::Io)?);
    let result = match parsed.command.as_deref() {
        Some("fast-write") => {
            let mode = match parsed.flag("mode").unwrap_or("overwrite") {
                "create" => core::WriteMode::Create,
                "overwrite" => core::WriteMode::Overwrite,
                _ => {
                    print(core_fail(
                        "fast_write",
                        parsed.flag("path").unwrap_or(""),
                        "invalid_mode",
                        "mode must be create or overwrite.",
                    ));
                    return Ok(2);
                }
            };
            let content = match parsed.flag("content-file") {
                Some(file) => fs::read_to_string(file).map_err(CliError::Io)?,
                None => parsed.flag("content").unwrap_or("").to_string(),
            };
            core::fast_write(
                &root,
                &core::FastWriteInput {
                    path: parsed.required("path")?.to_string(),
                    content,
                    mode,
                    expected_hash: parsed.flag("expected-hash").map(str::to_string),
                    fsync: parsed.flag("fsync") != Some("false"),
                },
            )
        }
        Some("fast-apply") => {
            let patch = match parsed.flag("patch-file") {
                Some(file) => fs::read_to_string(file).map_err(CliError::Io)?,
                None => parsed.flag("patch").unwrap_or("").to_string(),
            };
            let expected_hashes = match parsed.flag("expected-hashes-file") {
                Some(file) => {
                    json::flat_string_map(&fs::read_to_string(file).map_err(CliError::Io)?)
                        .map_err(CliError::Parse)?
                }
                None => BTreeMap::new(),
            };
            let strip = parsed.number_allow_zero("strip", 1);
            let max = parsed.number("max-evidence-bytes", core::default_max_evidence_bytes());
            core::fast_apply(
                &root,
                &core::FastApplyInput {
                    patch,
                    strip,
                    expected_hashes,
                    max_evidence_bytes: max,
                },
            )
        }
        Some("doctor") => doctor(&root),
        Some(command) => return Err(CliError::Parse(format!("Unsupported command: {command}"))),
        None => unreachable!("command presence checked above"),
    };
    let ok = matches!(
        &result,
        crate::json::JsonValue::Object(items)
            if matches!(items.get("ok"), Some(crate::json::JsonValue::Bool(true)))
    );
    print(result);
    Ok(if ok { 0 } else { 2 })
}

pub fn json_string(input: &str) -> String {
    json::quote(input)
}

fn print(value: crate::json::JsonValue) {
    println!("{}", json::stringify(&value));
}

fn doctor(root: &std::path::Path) -> crate::json::JsonValue {
    let mut checks = BTreeMap::new();
    checks.insert(
        "root".to_string(),
        crate::json::JsonValue::String(root.display().to_string()),
    );
    checks.insert(
        "git".to_string(),
        crate::json::JsonValue::Bool(
            std::process::Command::new("git")
                .arg("--version")
                .output()
                .map(|item| item.status.success())
                .unwrap_or(false),
        ),
    );
    let mut output = BTreeMap::new();
    output.insert("ok".to_string(), crate::json::JsonValue::Bool(true));
    output.insert(
        "operation".to_string(),
        crate::json::JsonValue::String("doctor".to_string()),
    );
    output.insert(
        "status".to_string(),
        crate::json::JsonValue::String("ok".to_string()),
    );
    output.insert("checks".to_string(), crate::json::JsonValue::Object(checks));
    crate::json::JsonValue::Object(output)
}

fn core_fail(operation: &str, path: &str, error: &str, hint: &str) -> crate::json::JsonValue {
    let mut output = BTreeMap::new();
    output.insert("ok".to_string(), crate::json::JsonValue::Bool(false));
    output.insert(
        "operation".to_string(),
        crate::json::JsonValue::String(operation.to_string()),
    );
    output.insert(
        "path".to_string(),
        crate::json::JsonValue::String(path.to_string()),
    );
    output.insert(
        "error".to_string(),
        crate::json::JsonValue::String(error.to_string()),
    );
    output.insert(
        "hint".to_string(),
        crate::json::JsonValue::String(hint.to_string()),
    );
    crate::json::JsonValue::Object(output)
}

fn help() -> &'static str {
    "wonder-write-r CLI\n\nCommands:\n  fast-write --root <dir> --path <file> --content-file <file> [--mode create|overwrite] [--expected-hash <sha256>]\n  fast-apply --root <dir> --patch-file <file> [--strip <n>] [--expected-hashes-file <json>]\n  doctor --root <dir>\n"
}

#[derive(Debug)]
pub enum CliError {
    Io(std::io::Error),
    Parse(String),
}

impl std::fmt::Display for CliError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(source) => write!(formatter, "{source}"),
            Self::Parse(message) => write!(formatter, "{message}"),
        }
    }
}

#[derive(Debug)]
struct Args {
    command: Option<String>,
    help: bool,
    root: Option<String>,
    flags: BTreeMap<String, String>,
}

impl Args {
    fn parse<I>(mut args: I) -> Result<Self, CliError>
    where
        I: Iterator<Item = String>,
    {
        let command = args.next();
        let mut flags = BTreeMap::new();
        let mut help = false;
        while let Some(token) = args.next() {
            if token == "--help" {
                help = true;
                continue;
            }
            let Some(name) = token.strip_prefix("--") else {
                return Err(CliError::Parse(format!("Expected --flag, got {token}")));
            };
            let Some(value) = args.next() else {
                return Err(CliError::Parse(format!("Missing value for {token}.")));
            };
            flags.insert(name.to_string(), value);
        }
        let root = flags.remove("root");
        Ok(Self {
            command,
            help,
            root,
            flags,
        })
    }

    fn required(&self, name: &str) -> Result<&str, CliError> {
        self.flag(name)
            .ok_or_else(|| CliError::Parse(format!("Missing value for --{name}.")))
    }

    fn flag(&self, name: &str) -> Option<&str> {
        self.flags.get(name).map(String::as_str)
    }

    fn number(&self, name: &str, fallback: usize) -> usize {
        self.flag(name)
            .and_then(|item| item.parse::<usize>().ok())
            .filter(|item| *item >= 1)
            .unwrap_or(fallback)
    }

    fn number_allow_zero(&self, name: &str, fallback: usize) -> usize {
        self.flag(name)
            .and_then(|item| item.parse::<usize>().ok())
            .unwrap_or(fallback)
    }
}

impl From<OsString> for CliError {
    fn from(value: OsString) -> Self {
        Self::Parse(value.to_string_lossy().to_string())
    }
}
