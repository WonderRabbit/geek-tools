#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
target="x86_64-pc-windows-gnu"
name="wonder-write-r-${target}"
release_dir="release/${name}"

rm -rf "release/${name}" "release/${name}.zip"
mkdir -p "${release_dir}/opencode/.opencode/bin"
cp -R .opencode/. "${release_dir}/opencode/.opencode/"
cp "target/${target}/release/wonder-write-r.exe" "${release_dir}/opencode/.opencode/bin/wonder-write-r.exe"
cp README.md "${release_dir}/README.md"
(
  cd release
  zip -qr "${name}.zip" "${name}"
)
shasum -a 256 "release/${name}.zip" > "release/${name}.zip.sha256"
rm -rf "${release_dir}"
