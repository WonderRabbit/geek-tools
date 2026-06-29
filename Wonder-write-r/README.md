# Wonder-write-r

Rust executable version of the OpenWrite helper for OpenCode projects.

It mirrors the existing Node OpenWrite contract:

- `fast-write`: workspace-relative atomic file creation or replacement with optional SHA-256 guard.
- `fast-apply`: workspace-relative unified diff application through `git apply --check` before mutation.
- `doctor`: small executable sanity check.

## Build

```sh
PATH="/opt/homebrew/opt/rustup/bin:$PATH" cargo test
PATH="/opt/homebrew/opt/rustup/bin:$PATH" cargo build --release
PATH="/opt/homebrew/opt/rustup/bin:$PATH" cargo build --release --target x86_64-pc-windows-gnu
./scripts/package-release.sh
```

The Windows release bundle is written to:

```text
Wonder-write-r/release/wonder-write-r-x86_64-pc-windows-gnu.zip
```

## CLI

```sh
./target/release/wonder-write-r fast-write --root <project> --path docs/large.md --content-file content.md --mode create
./target/release/wonder-write-r fast-apply --root <project> --patch-file change.patch
./target/release/wonder-write-r doctor --root <project>
```

## OpenCode

Copy the bundled `.opencode` files into a project and place the executable at:

```text
.opencode/bin/wonder-write-r.exe
```

Alternatively set:

```powershell
$env:WONDER_WRITE_R_EXE = "C:\tools\wonder-write-r.exe"
```
