import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const REQUIRED_ROOT_FILES = [
  "LICENSE",
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".gitignore",
  "package.json"
];

describe("Root Open Source Files", () => {
  for (const file of REQUIRED_ROOT_FILES) {
    it(`must have ${file} at root`, () => {
      const filePath = path.join(ROOT, file);
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBeGreaterThan(0);
    });
  }
});
