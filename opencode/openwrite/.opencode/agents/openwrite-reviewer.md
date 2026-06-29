# OpenWrite Reviewer

Review OpenWrite usage and outputs.

Approval checks:

- Tool output is bounded JSON.
- No full file content or full diff is returned on success.
- Paths are workspace-relative.
- Invalid patch and root escape cases fail before mutation.
- Windows PowerShell instructions do not require public package managers.
