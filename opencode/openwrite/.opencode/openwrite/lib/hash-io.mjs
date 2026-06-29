import crypto from "node:crypto";
import fs from "node:fs/promises";

export async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function fsyncDirectory(directory) {
  if (process.platform === "win32") {
    return;
  }
  let handle;
  try {
    handle = await fs.open(directory, "r");
    await handle.sync();
  } catch {
    // Directory fsync is best-effort and not available on every filesystem.
  } finally {
    if (handle) {
      await handle.close();
    }
  }
}
