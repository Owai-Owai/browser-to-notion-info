import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync,readFileSync,readdirSync,writeFileSync } from "node:fs";
import { join,relative,resolve,sep } from "node:path";
import { unzipSync,zipSync } from "fflate";

const source = resolve("dist-public");
const checked = spawnSync(process.execPath,["scripts/verify-package.mjs",source,"--public"],{ stdio: "inherit" });
if (checked.status !== 0) process.exit(checked.status || 1);

function collect(directory) {
  return readdirSync(directory,{ withFileTypes: true }).flatMap(entry => {
    const path = join(directory,entry.name);
    assert.ok(!entry.isSymbolicLink(),"Store packages must contain regular build files.");
    return entry.isDirectory() ? collect(path) : [[relative(source,path).split(sep).join("/"),readFileSync(path)]];
  });
}

const files = Object.fromEntries(collect(source));
const developmentManifest = JSON.parse(files["manifest.json"].toString("utf8"));
assert.ok(developmentManifest.key,"The unpacked build must retain its development identity.");
assert.match(developmentManifest.version,/^\d+(?:\.\d+){0,3}$/);
assert.equal(developmentManifest.version,JSON.parse(readFileSync("package.json","utf8")).version,"Rebuild the public extension after changing its version.");
assert.equal(developmentManifest.key,JSON.parse(readFileSync("extension.config.json","utf8")).key,"Rebuild the public extension after changing its store identity.");

// The key pins unpacked development installs; the Web Store assigns its own identity.
const storeManifest = { ...developmentManifest };
delete storeManifest.key;
files["manifest.json"] = Buffer.from(JSON.stringify(storeManifest,null,2) + "\n");

const output = resolve("release",`browser-to-notion-public-${storeManifest.version}.zip`);
mkdirSync(resolve("release"),{ recursive: true });
writeFileSync(output,zipSync(files,{ level: 9 }));

// Check the written upload artifact, including every asset and the root manifest.
const archived = unzipSync(readFileSync(output));
assert.deepEqual(Object.keys(archived).sort(),Object.keys(files).sort());
const archivedManifest = JSON.parse(Buffer.from(archived["manifest.json"]).toString("utf8"));
assert.ok(!Object.hasOwn(archivedManifest,"key"),"The Web Store upload manifest must omit key.");
assert.deepEqual(archivedManifest,storeManifest);
for (const [name,bytes] of Object.entries(files)) {
  assert.ok(Buffer.from(archived[name]).equals(bytes),`Archive asset mismatch: ${name}`);
}
assert.deepEqual(JSON.parse(readFileSync(join(source,"manifest.json"),"utf8")),developmentManifest);
console.info(`Created verified Web Store ZIP: ${output}`);
console.info("Upload manifest omits key; the unpacked build retains its identity.");
