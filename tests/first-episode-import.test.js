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
const styles = fs.readFileSync(path.join(__dirname, "../app/styles.css"), "utf8");

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

test("createShow stores presetId alongside presetName for style carry-over", () => {
  library._resetCounters();
  const show = library.createShow("Founders Unfiltered", {
    presetId: "split-stage",
    presetName: "Split Stage",
  });
  assert.strictEqual(show.presetId, "split-stage");
  assert.strictEqual(show.presetName, "Split Stage");
});

test("resolveStyleSelection prefers show.presetId over presetName lookup", () => {
  library._resetCounters();
  const show = library.createShow("Agency Weekly", {
    presetId: "studio-spotlight",
    presetName: "Split Stage",
  });
  const selection = identity.resolveStyleSelection(show, null);
  assert.strictEqual(selection.presetId, "studio-spotlight");
});

test("attachPlaceholderFile seeds a synced filename per speaker bucket", () => {
  const host = setup.attachPlaceholderFile(setup.createSpeaker("Host"));
  assert.strictEqual(host.fileName, "host-synced.mp4");
  assert.ok(host.fileSize > 0);

  const guest = setup.attachPlaceholderFile(setup.createSpeaker("Guest 2"));
  assert.strictEqual(guest.fileName, "guest-2-synced.mp4");
});

test("upload draft with placeholder files validates for sandbox import", () => {
  const draft = setup.createDraft();
  draft.episodeName = "Founders Unfiltered — Episode 1";
  draft.sourceMode = "upload";
  draft.speakers.forEach((speaker) => setup.attachPlaceholderFile(speaker));
  draft.speakers.forEach((speaker, index) => {
    speaker.name = `Speaker ${index + 1}`;
  });

  const result = setup.validateDraft(draft);
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
  const summary = setup.summarize(draft);
  assert.strictEqual(summary.sourceModeLabel, "Uploaded speaker files");
  assert.deepStrictEqual(
    summary.speakers.map((speaker) => speaker.sourceLabel),
    ["host-synced.mp4", "guest-1-synced.mp4", "guest-2-synced.mp4"],
  );
});

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
  assert.ok(recap.styleLine.includes("Split Stage"));
});

test("buildEpisodeStart carries preset style into first-episode import context", () => {
  library._resetCounters();
  let lib = library.createLibrary();
  const show = library.createShow("Founders Unfiltered", {
    presetId: "split-stage",
    presetName: "Split Stage",
  });
  lib = library.addShow(lib, show);
  const start = identity.buildEpisodeStart(library.getShow(lib, show.id), null);

  assert.ok(start.setupDraft);
  assert.strictEqual(start.styleSelection.presetId, "split-stage");
  assert.ok(start.appliedStyle);
  assert.strictEqual(start.appliedStyle.presetName, "Split Stage");
});

test("workspace setup stage names imported speakers after setup completes", () => {
  const summary = setup.summarize(completeRiversideDraft());
  const ws = workspace.buildWorkspace(summary, {});
  const setupStage = workspace.getStage(ws, "setup");
  assert.ok(setupStage.summary.includes("Sam Rivera"));
  assert.ok(setupStage.summary.includes("Host"));
  assert.ok(setupStage.summary.includes("Riverside link"));
});

test("ACCEPTANCE: first-episode import step exposes placeholders and workspace recap", () => {
  library._resetCounters();
  let lib = library.createLibrary();
  const show = library.createShow("Agency Weekly", {
    presetId: "panel-grid",
    presetName: "Panel Grid",
  });
  lib = library.addShow(lib, show);
  const start = identity.buildEpisodeStart(library.getShow(lib, show.id), null);
  const draft = Object.assign({}, start.setupDraft, completeRiversideDraft());
  draft.episodeName = start.setupDraft.episodeName;

  assert.strictEqual(onboarding.firstStepAfterCreateShow(), "episode-setup");
  assert.strictEqual(setup.validateDraft(draft).ok, true);
  const summary = setup.summarize(draft);
  const recap = setup.buildImportRecap(summary, { appliedStyle: start.appliedStyle });
  assert.strictEqual(recap.speakerLines.length, 3);
  assert.ok(recap.styleLine.includes("Panel Grid"));

  assert.ok(ui.includes("renderCombinedFirstEpisodeImport"));
  assert.ok(ui.includes("renderFirstEpisodeImport"));
  assert.ok(ui.includes("finishCombinedFirstEpisodeImport"));
  assert.ok(ui.includes("startEpisodeFromShow(show.id)"));
  assert.ok(ui.includes("First episode import"));
  assert.ok(ui.includes("setup-combined-create"));
  assert.ok(ui.includes("setup-first-episode-import"));
  assert.ok(ui.includes("import-ready-summary"));
  assert.ok(ui.includes("file-placeholder-btn"));
  assert.ok(ui.includes("Attach placeholder file"));
  assert.ok(ui.includes("f-riversideLink"));
  assert.ok(ui.includes("speaker-social-group"));
  assert.ok(ui.includes("renderEpisodeImportRecap"));
  assert.ok(ui.includes("readSetupFormState();"));
  assert.ok(styles.includes(".import-ready-summary"));
  assert.ok(styles.includes(".episode-import-recap"));
  assert.ok(styles.includes(".setup-combined-create"));
});

console.log(`\nfirst episode import: ${passed} assertions passed`);
