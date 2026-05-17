// Prune CSS rules for a migration cluster without touching partial/shared rules.
// Usage:
//   node _bbtmp-clusterprune.mjs <cssFile> <class1,class2,...>
//   node _bbtmp-clusterprune.mjs <cssFile> <class1> <class2> <class3>
import fs from "fs";
import postcss from "postcss";

const cssFile = process.argv[2];
const rawClasses = process.argv.slice(3);

if (!cssFile || rawClasses.length === 0) {
  console.error("usage: node _bbtmp-clusterprune.mjs <cssFile> <class1,class2,...>");
  process.exit(1);
}

const classNames = rawClasses
  .flatMap((chunk) => chunk.split(","))
  .map((name) => name.trim().replace(/^\./, ""))
  .filter(Boolean);

if (classNames.length === 0) {
  console.error("no classes provided");
  process.exit(1);
}

const removeSet = new Set(classNames);
const css = fs.readFileSync(cssFile, "utf8");
const root = postcss.parse(css, { from: cssFile });

const classPattern = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;

function getClassesFromSelector(selector) {
  const classes = [];
  let match = classPattern.exec(selector);
  while (match) {
    classes.push(match[1]);
    match = classPattern.exec(selector);
  }
  classPattern.lastIndex = 0;
  return classes;
}

function selectorOnlyUsesClusterClasses(selector) {
  const classes = getClassesFromSelector(selector);
  if (classes.length === 0) return false;
  return classes.every((name) => removeSet.has(name));
}

let removedRules = 0;
root.walkRules((rule) => {
  if (!rule.selectors || rule.selectors.length === 0) return;
  const shouldRemove = rule.selectors.every(selectorOnlyUsesClusterClasses);
  if (!shouldRemove) return;
  removedRules += 1;
  rule.remove();
});

let removedAtrules = 0;
root.walkAtRules((atRule) => {
  if (!["media", "supports", "layer"].includes(atRule.name)) return;
  let hasAnyRule = false;
  atRule.walkRules(() => {
    hasAnyRule = true;
  });
  if (hasAnyRule) return;
  removedAtrules += 1;
  atRule.remove();
});

fs.writeFileSync(cssFile, root.toResult({ map: false }).css, "utf8");

console.log(`pruned rules: ${removedRules}`);
console.log(`pruned empty at-rules: ${removedAtrules}`);
console.log(`classes: ${classNames.join(", ")}`);
