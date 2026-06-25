"use strict";

// Import-to-workspace handoff smoke suite for Podcast Design Canvas (#142).
// Run with: `node tests/import-handoff.test.js`.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const setup = require("../app/episode-setup.js");
const workspace = require("../app/episode-workspace.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const ui = fs.readFileSync(path.join(__dirname, "../app/episode-setup.ui.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "../app/styles.css"), "utf8");

function completeRiversideDraft() {
  const draft = setup.createDraft();
  draft.episodeName = "Founders Unfiltered — Episode 1";
  draft.riversideLink = "https://riverside.fm/studio/founders-ep1";
  draft.speakers[0].name = "Sam Rivera";
  draft.speakers[0].social.twitter = "https://x.com/samrivera";
  draft.speakers[1].name = "Dana Kim";
  draft.speakers[2].name = "Alex Chen";
  draft.speakers[2].social.linkedin = "https://linkedin.com/in/alexchen";
  return draft;
}

test("buildImportHandoff surfaces source, speaker identities, and social context", () => {
  const summary = setup.summarize(completeRiversideDraft());
  const handoff = setup.buildImportHandoff(summary);

  assert.ok(/imported sources/i.test(handoff.confirmationLead));
  assert.strictEqual(handoff.sourceLabel, "Riverside link");
  assert.ok(handoff.sourceDetail.includes("riverside.fm"));
  assert.strictEqual(handoff.speakers.length, 3);
  assert.strictEqual(handoff.speakers[0].identityLine, "Sam Rivera · Host");
  assert.ok(handoff.speakers[0].socialLine.includes("X:"));
  assert.strictEqual(handoff.speakers[1].socialLine, "No social links added");
  assert.strictEqual(handoff.socialLinkCount, 2);
});

test("buildImportHandoff reflects uploaded speaker files per bucket", () => {
  const draft = setup.createDraft();
  draft.episodeName = "Agency Weekly — Episode 1";
  draft.sourceMode = "upload";
  draft.speakers.forEach((speaker) => setup.attachPlaceholderFile(speaker));
  draft.speakers.forEach((speaker, index) => {
    speaker.name = `Speaker ${index + 1}`;
  });

  const handoff = setup.buildImportHandoff(setup.summarize(draft));
  assert.strictEqual(handoff.sourceLabel, "Uploaded speaker files");
  assert.deepStrictEqual(
    handoff.speakers.map((speaker) => speaker.sourceLabel),
    ["host-synced.mp4", "guest-1-synced.mp4", "guest-2-synced.mp4"],
  );
});

test("workspace setup stage summary names imported speakers and source", () => {
  const episode = setup.summarize(completeRiversideDraft());
  const ws = workspace.buildWorkspace(episode, { contextApproved: false });
  const setupStage = workspace.getStage(ws, "setup");

  assert.ok(setupStage.summary.includes("Sam Rivera (Host)"));
  assert.ok(setupStage.summary.includes("riverside.fm"));
  assert.ok(setupStage.summary.includes("2 social links saved"));
  assert.ok(setupStage.summary.includes("context ready to review"));
});

test("import handoff UI and styles expose accepted-import recap", () => {
  assert.ok(ui.includes("ES.buildImportHandoff(summary)"));
  assert.ok(ui.includes("episode-import-handoff"));
  assert.ok(ui.includes("Import accepted"));
  assert.ok(styles.includes(".episode-import-handoff-speakers"));
});

test("ACCEPTANCE: invalid import stays blocked while valid import produces handoff data", () => {
  const invalid = setup.createDraft();
  const invalidResult = setup.validateDraft(invalid);
  assert.strictEqual(invalidResult.ok, false);
  assert.ok(invalidResult.errors.riversideLink);
  assert.ok(Object.keys(invalidResult.errors).some((key) => key.indexOf("speaker:") === 0));

  const valid = setup.summarize(completeRiversideDraft());
  const handoff = setup.buildImportHandoff(valid);
  assert.strictEqual(handoff.speakers.length, 3);
  assert.ok(handoff.speakers.every((speaker) => speaker.role && speaker.sourceLabel));
});

console.log(`\nimport handoff: ${passed} assertions passed`);
