use std::fs;
use std::process::Command;

#[test]
fn fast_write_creates_file_when_create_mode() {
    let root = temp_root("wwr-write");
    let content = root.join("content.txt");
    fs::write(&content, "after\n").unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_wonder-write-r"))
        .args([
            "fast-write",
            "--root",
            root.to_str().unwrap(),
            "--path",
            "docs/large.md",
            "--content-file",
            content.to_str().unwrap(),
            "--mode",
            "create",
        ])
        .output()
        .unwrap();

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("\"ok\":true"));
    assert!(stdout.contains("\"operation\":\"fast_write\""));
    assert!(stdout.contains("\"path\":\"docs/large.md\""));
    assert!(!stdout.contains("\"content\""));
    assert!(!stdout.contains("\"diff\""));
    assert_eq!(
        fs::read_to_string(root.join("docs/large.md")).unwrap(),
        "after\n"
    );
}

#[test]
fn fast_write_refuses_stale_expected_hash() {
    let root = temp_root("wwr-hash");
    let target = root.join("target.txt");
    fs::write(&target, "before").unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_wonder-write-r"))
        .args([
            "fast-write",
            "--root",
            root.to_str().unwrap(),
            "--path",
            "target.txt",
            "--content",
            "after",
            "--expected-hash",
            "0000000000000000000000000000000000000000000000000000000000000000",
        ])
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(2));
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("\"error\":\"expected_hash_mismatch\""));
    assert_eq!(fs::read_to_string(target).unwrap(), "before");
}

#[test]
fn fast_apply_applies_valid_patch() {
    let root = temp_root("wwr-apply");
    fs::write(root.join("target.txt"), "before\n").unwrap();
    Command::new("git")
        .args(["init"])
        .current_dir(&root)
        .output()
        .unwrap();
    Command::new("git")
        .args(["add", "target.txt"])
        .current_dir(&root)
        .output()
        .unwrap();
    Command::new("git")
        .args(["commit", "-m", "initial"])
        .current_dir(&root)
        .env("GIT_AUTHOR_NAME", "Test")
        .env("GIT_AUTHOR_EMAIL", "test@example.com")
        .env("GIT_COMMITTER_NAME", "Test")
        .env("GIT_COMMITTER_EMAIL", "test@example.com")
        .output()
        .unwrap();
    let patch = root.join("change.patch");
    fs::write(
        &patch,
        "--- a/target.txt\n+++ b/target.txt\n@@ -1 +1 @@\n-before\n+after\n",
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_wonder-write-r"))
        .args([
            "fast-apply",
            "--root",
            root.to_str().unwrap(),
            "--patch-file",
            patch.to_str().unwrap(),
        ])
        .output()
        .unwrap();

    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("\"ok\":true"));
    assert!(stdout.contains("\"operation\":\"fast_apply\""));
    assert_eq!(
        fs::read_to_string(root.join("target.txt")).unwrap(),
        "after\n"
    );
}

fn temp_root(prefix: &str) -> std::path::PathBuf {
    let root = std::env::temp_dir().join(format!(
        "{}-{}-{}",
        prefix,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();
    root
}
