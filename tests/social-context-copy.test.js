"use strict";

// Social context import copy smoke suite for Podcast Design Canvas (#139).
// Run with: `node tests/social-context-copy.test.js`.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const setup = require("../app/episode-setup.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const ui = fs.readFileSync(path.join(__dirname, "../app/episode-setup.ui.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "../app/styles.css"), "utf8");

function completeRiversideDraftWithoutSocialLinks() {
  const draft = setup.createDraft();
  draft.episodeName = "Founders Unfiltered — Episode 1";
  draft.riversideLink = "https://riverside.fm/studio/founders-ep1";
  draft.speakers[0].name = "Sam Rivera";
  draft.speakers[1].name = "Dana Kim";
  draft.speakers[2].name = "Alex Chen";
  return draft;
}

test("socialLinksBenefitLine explains spellings, captions, and optional trust", () => {
  const line = setup.socialLinksBenefitLine();
  assert.ok(/spell names correctly/i.test(line));
  assert.ok(/captions/i.test(line));
  assert.ok(/visual moments/i.test(line));
  assert.ok(/optional/i.test(line));
  assert.ok(!/crawl/i.test(line) || /never invasive research/i.test(line));
});

test("importSocialContextCueLine explains transcript and visual accuracy", () => {
  const line = setup.importSocialContextCueLine();
  assert.ok(/transcript spellings/i.test(line));
  assert.ok(/captions/i.test(line));
  assert.ok(/on-screen moments/i.test(line));
  assert.ok(/optional/i.test(line));
  assert.ok(/still works/i.test(line));
});

test("import UI wires shared social context copy helpers", () => {
  assert.ok(ui.includes("ES.socialLinksBenefitLine()"));
  assert.ok(ui.includes("ES.importSocialContextCueLine()"));
  assert.ok(ui.includes("setup-social-context-cue"));
  assert.ok(ui.includes("speaker-social-benefit"));
  assert.ok(ui.includes("Social links for smarter edits (optional)"));
  assert.ok(styles.includes(".setup-social-context-cue"));
  assert.ok(styles.includes(".speaker-social-benefit"));
});

test("ACCEPTANCE: import validates without social links while benefit copy is available", () => {
  const draft = completeRiversideDraftWithoutSocialLinks();
  const result = setup.validateDraft(draft);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  assert.strictEqual(setup.summarize(draft).socialLinkCount, 0);
  assert.ok(setup.socialLinksBenefitLine().length > 0);
  assert.ok(setup.importSocialContextCueLine().length > 0);
});

console.log(`\nsocial context copy: ${passed} assertions passed`);
