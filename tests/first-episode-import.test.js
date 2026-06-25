"use strict";

// First-episode import smoke suite for Podcast Design Canvas (#130).
// Run with: `node tests/first-episode-import.test.js`.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const setup = require("../app/episode-setup.js");
const style = require("../app/episode-style.js");
const identity = require("../app/show-identity.js");
const library = require("../app/show-library.js");
const onboarding = require("../app/show-onboarding.js");
const workspace = require("../app/episode-workspace.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const ui = fs.readFileSync(path.join(__dirname, "../app/episode-setup.ui.js"), "utf8");

function completeRiversideDraft() {
  const draft = setup.createDraft();
  draft.episodeName = "Founders Unfiltered — Episode 1";
  draft.sourceMode = "riverside";
  draft.riversideLink = "https://riverside.fm/studio/founders-ep1";
  draft.speakers[0].name = "Sam Rivera";
  draft.speakers[0].social.twitter = "https://x.com/samrivera";
  draft.speakers[1].name = "Dana Kim";
  draft.speakers[2].name = "Alex Chen";
  draft.speakers[2].social.linkedin = "https://linkedin.com/in/alexchen";
  return draft;
}

test("buildImportRecap surfaces speakers, source, and applied style", () => {
  const summary = setup.summarize(completeRiversideDraft());
  const appliedStyle = style.summarizeStyle(
    style.applyPresetToSelection(style.createSelection(), "split-stage"),
    summary.speakerCount,
  );
  const recap = setup.buildImportRecap(summary, { appliedStyle: appliedStyle });

  assert.strictEqual(recap.sourceModeLabel, "Riverside link");
  assert.strictEqual(recap.sourceDetail, "https://riverside.fm/studio/founders-ep1");
  assert.strictEqual(recap.speakerLines.length, 3);
  assert.strictEqual(recap.speakerLines[0].name, "Sam Rivera");
  assert.strictEqual(recap.speakerLines[0].role, "Host");
  assert.strictEqual(recap.speakerLines[0].socialCount, 1);
  assert.ok(recap.styleLine.includes("Split Stage"));
});

test("create show routes to episode import setup, not brand kit", () => {
  library._resetCounters();
  let lib = library.createLibrary();
  const show = library.createShow("Founders Unfiltered", { presetName: "Studio Spotlight" });
  lib = library.addShow(lib, show);
  const stored = library.getShow(lib, show.id);
  const start = identity.buildEpisodeStart(stored, { templates: [] });

  assert.strictEqual(onboarding.firstStepAfterCreateShow(), "episode-setup");
  assert.ok(start.setupDraft);
  assert.ok(Array.isArray(start.setupDraft.speakers));
  assert.strictEqual(start.setupDraft.speakers.length, 3);
  assert.ok(/Episode 1/.test(start.setupDraft.episodeName));
  assert.ok(start.appliedStyle && start.appliedStyle.presetName === "Studio Spotlight");
});

test("workspace setup stage names imported speakers after setup completes", () => {
  const summary = setup.summarize(completeRiversideDraft());
  const ws = workspace.buildWorkspace(summary, {});
  const setupStage = workspace.getStage(ws, "setup");
  assert.ok(setupStage.summary.includes("Sam Rivera"));
  assert.ok(setupStage.summary.includes("Host"));
  assert.ok(setupStage.summary.includes("Riverside link"));
});

test("ACCEPTANCE: create show and import episode collects real sources through workspace recap", () => {
  library._resetCounters();
  let lib = library.createLibrary();
  const show = library.createShow("Agency Weekly", { presetName: "Panel Grid" });
  lib = library.addShow(lib, show);
  const start = identity.buildEpisodeStart(library.getShow(lib, show.id), { templates: [] });
  const draft = Object.assign({}, start.setupDraft, completeRiversideDraft());
  draft.episodeName = start.setupDraft.episodeName;

  assert.strictEqual(setup.validateDraft(draft).ok, true);
  const summary = setup.summarize(draft);
  const recap = setup.buildImportRecap(summary, { appliedStyle: start.appliedStyle });

  assert.strictEqual(recap.speakerLines.length, 3);
  assert.ok(recap.styleLine.includes("Panel Grid"));
  assert.ok(ui.includes("startEpisodeFromShow(show.id)"));
  assert.ok(ui.includes("renderImportRecapCard"));
  assert.ok(ui.includes("readSetupFormState();"));
  assert.ok(ui.includes('class: "setup setup-import"'));
  assert.ok(ui.includes("type: \"file\""));
  assert.ok(ui.includes("speaker-social-group"));
});

console.log(`\nfirst episode import: ${passed} assertions passed`);
