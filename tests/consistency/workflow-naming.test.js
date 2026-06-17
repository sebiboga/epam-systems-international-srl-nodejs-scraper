import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.resolve(__dirname, "../../.github/workflows");

describe("Consistency: Workflow File Naming", () => {
  const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith(".yml"));

  it("should not have generic test.yml", () => {
    expect(files).not.toContain("test.yml");
  });

  it("should have descriptive workflow names", () => {
    for (const f of files) {
      expect(f).toMatch(/^[a-z0-9-]+\.yml$/);
      expect(f.startsWith("job-") || f.includes("automation") ||
             f.includes("deploy") || f.includes("test")).toBe(true);
    }
  });

  it("should have correct workflow naming for automation testing", () => {
    expect(files).toContain("automation-testing.yml");
  });
});
