import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const SUPPORTED_EXTENSIONS = new Set([".css", ".js", ".jsx", ".json", ".mjs", ".ts", ".tsx"]);
const workspacePath = process.cwd();
const baseRef = process.env.PRETTIER_BASE_REF?.trim();
const headRef = process.env.PRETTIER_HEAD_REF?.trim() || "HEAD";

function getChangedFiles() {
  const sharedArgs = ["--name-only", "-z", "--diff-filter=ACMR", "--relative"];
  const rangeArgs =
    baseRef && !/^0+$/.test(baseRef)
      ? ["diff", ...sharedArgs, baseRef, headRef, "--", "."]
      : baseRef
        ? ["diff-tree", "--no-commit-id", "-r", ...sharedArgs, headRef, "--", "."]
        : ["diff", "--cached", ...sharedArgs, "--", "."];

  try {
    return execFileSync("git", rangeArgs, { cwd: workspacePath })
      .toString("utf8")
      .split("\0")
      .filter((filePath) => SUPPORTED_EXTENSIONS.has(path.extname(filePath)));
  } catch {
    console.error("Không chạy được: không xác định được các tệp cần kiểm tra định dạng.");
    process.exit(1);
  }
}

const changedFiles = getChangedFiles();

if (changedFiles.length === 0) {
  console.log("Không có tệp mã nguồn mới nào cần kiểm tra định dạng.");
  process.exit(0);
}

const prettierCli = path.join(workspacePath, "node_modules", "prettier", "bin", "prettier.cjs");
const result = spawnSync(
  process.execPath,
  [prettierCli, "--check", "--ignore-unknown", ...changedFiles],
  {
    cwd: workspacePath,
    stdio: "inherit",
  },
);

if (result.error) {
  console.error("Không chạy được: không thể khởi động công cụ kiểm tra định dạng.");
  process.exit(1);
}

process.exit(result.status ?? 1);
