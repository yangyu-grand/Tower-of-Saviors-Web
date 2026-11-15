import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const match = html.match(/<script type="module">([\\s\\S]*?)<\\/script>/);

test("the embedded browser module parses after removing static imports", () => {
  assert.ok(match, "index.html must contain its browser module");
  const source = match[1].replace(/^\\s*import\\s+.*?;\\s*$/gm, "");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "index.html#module" }));
});

test("the inventory UI exposes progression controls and the saved progression module", () => {
  assert.match(html, /from "\.\/progression\.js"/);
  assert.match(html, /id="inventoryGrid"/);
  assert.match(html, /特訓升級/);
  assert.match(html, /隊伍全員獲得/);
});
