import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const runtimeRoots = ["app", "components", "lib"].map((segment) =>
  path.join(projectRoot, segment),
);
const scanExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const bannedFiles = [path.join(projectRoot, "scripts", "mock-api-server.mjs")];
const bannedPatterns = [
  { label: "legacy header menu fixture", pattern: /\bWP_PRODUCT_MENU\b/ },
  { label: "legacy footer business data", pattern: /\bWP_FOOTER_[A-Z_]+\b/ },
  { label: "legacy contact fixture", pattern: /\bWP_CONTACTS\b/ },
  { label: "legacy footer link fixture", pattern: /\bWP_INFO_LINKS\b/ },
  { label: "legacy homepage about HTML fixture", pattern: /\bWP_ABOUT_HTML\b/ },
  { label: "legacy homepage bottom HTML fixture", pattern: /\bWP_CONTENT_BOTTOM_HTML\b/ },
  { label: "legacy homepage FAQ fixture", pattern: /\bHOME_FAQS\b/ },
  { label: "legacy experience media fixture", pattern: /\bLEGACY_EXPERIENCE_MEDIA\b/ },
  { label: "legacy homepage brand priority fixture", pattern: /\bHOMEPAGE_BRAND_PRIORITY\b/ },
  { label: "legacy news intro fixture", pattern: /\bNEWS_INTRO\b/ },
  { label: "legacy news outro fixture", pattern: /\bNEWS_OUTRO\b/ },
  { label: "legacy category ordering fixture", pattern: /\bCATEGORY_ORDER\b/ },
  { label: "legacy promo banner asset", pattern: /\/wp\/banner-ads\.jpg/ },
  { label: "legacy storefront email", pattern: /bigbikevnshop@gmail\.com/i },
  {
    label: "legacy storefront phone number",
    pattern: /(?:0764[\s.]?640[\s.]?679|028[\s.]?62797251|0906[\s.]?90[\s.]?2404)/,
  },
  { label: "legacy storefront address fragment", pattern: /79\/30\/52/ },
  { label: "legacy storefront social handle", pattern: /bigbikegear/i },
];

const violations = [];

for (const bannedFile of bannedFiles) {
  if (fs.existsSync(bannedFile)) {
    violations.push(
      `${path.relative(projectRoot, bannedFile)}: file must not exist in the web runtime toolchain.`,
    );
  }
}

for (const root of runtimeRoots) {
  walkRuntimeFiles(root);
}

if (violations.length > 0) {
  console.error("Runtime mock/business data guard failed.\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Runtime mock/business data guard passed.");

function walkRuntimeFiles(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkRuntimeFiles(fullPath);
      continue;
    }

    if (!scanExtensions.has(path.extname(entry.name))) {
      continue;
    }

    const source = fs.readFileSync(fullPath, "utf8");
    for (const { label, pattern } of bannedPatterns) {
      const match = pattern.exec(source);
      if (!match || match.index < 0) {
        continue;
      }

      const line = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push(`${path.relative(projectRoot, fullPath)}:${line} contains ${label}.`);
    }
  }
}
