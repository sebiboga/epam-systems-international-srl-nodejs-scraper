import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

function parseLatestChangelogVersion() {
  const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf-8");
  const match = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m);
  if (!match) throw new Error("Could not find version in CHANGELOG.md");
  return match[1];
}

function parsePackageJsonVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
  return pkg.version;
}

describe("Version Consistency", () => {
  it("package.json version must match latest CHANGELOG version", () => {
    const changelogVersion = parseLatestChangelogVersion();
    const pkgVersion = parsePackageJsonVersion();
    expect(pkgVersion).toBe(changelogVersion);
  });
});
