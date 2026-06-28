"use strict";

// Audio polish smoke suite for Podcast Design Canvas (#15).
// Guards quality presets, per-speaker tracks, control adjustments, and review summary.
// Run with: `node tests/audio-polish.test.js`.

const assert = require("assert");
const setup = require("../app/episode-setup.js");
const audio = require("../app/audio-polish.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

function completeUploadDraft() {
  const draft = setup.createDraft();
  draft.episodeName = "Founders Unfiltered #7";
  draft.sourceMode = "upload";
  draft.speakers = [
    Object.assign(setup.createSpeaker("Host"), { name: "Sam Rivera" }),
    Object.assign(setup.createSpeaker("Guest 1"), { name: "Dana Kim" }),
    Object.assign(setup.createSpeaker("Guest 2"), { name: "Marco Vidal" }),
  ];
  draft.speakers.forEach((speaker, index) => {
    const fileName = ["sam.mp4", "dana.mp4", "marco.mp4"][index];
    setup.attachSourceMediaAsset(speaker, {
      assetId: `source-media-${index + 1}`,
      fileName,
      fileSize: 4096,
      mimeType: "video/mp4",
      storage: "indexedDB",
    });
  });
  return draft;
}

test("offers Natural, Clean, and Studio quality presets", () => {
  assert.strictEqual(audio.QUALITY_PRESETS.length, 3);
  const ids = audio.QUALITY_PRESETS.map((preset) => preset.id);
  assert.deepStrictEqual(ids, ["natural", "clean", "studio"]);
  audio.QUALITY_PRESETS.forEach((preset) => {
    assert.ok(preset.name && preset.tagline, `${preset.id} is described for creators`);
  });
});

test("createPolish seeds speaker tracks from the episode summary", () => {
  const episode = setup.summarize(completeUploadDraft());
  const polish = audio.createPolish(episode);
  assert.strictEqual(polish.presetId, "clean");
  assert.strictEqual(polish.speakers.length, 3);
  assert.deepStrictEqual(polish.speakers.map((track) => track.role), ["Host", "Guest 1", "Guest 2"]);
  assert.strictEqual(polish.speakers[0].sourceLabel, "sam.mp4");
  assert.strictEqual(polish.speakers[0].sourceMode, "upload");
});

test("createPolish preserves imported source media references for downstream processing", () => {
  const draft = setup.createDraft();
  draft.episodeName = "Founders Unfiltered #7";
  draft.sourceMode = "upload";
  draft.speakers = [
    Object.assign(setup.createSpeaker("Host"), { name: "Sam Rivera" }),
    Object.assign(setup.createSpeaker("Guest 1"), { name: "Dana Kim", fileName: "dana.mp4" }),
    Object.assign(setup.createSpeaker("Guest 2"), { name: "Marco Vidal", fileName: "marco.mp4" }),
  ];
  setup.attachSourceMediaAsset(draft.speakers[0], {
    assetId: "source-media-sam",
    fileName: "sam.wav",
    fileSize: 8192,
    mimeType: "audio/wav",
    storage: "indexedDB",
    storedAt: 1760000000000,
  });
  const episode = setup.summarize(draft);
  const polish = audio.createPolish(episode);
  assert.strictEqual(polish.speakers[0].hasSourceMedia, true);
  assert.deepStrictEqual(polish.speakers[0].sourceMedia, episode.speakers[0].sourceMedia);
  assert.strictEqual(polish.speakers[1].hasSourceMedia, false);

  const summary = audio.summarizePolish(polish);
  assert.strictEqual(summary.sourceMediaCount, 1);
  assert.strictEqual(summary.sourceMediaReady, false);
});

test("applyPreset updates all polish controls", () => {
  const episode = setup.summarize(completeUploadDraft());
  let polish = audio.createPolish(episode);
  polish = audio.applyPolish(polish, { appliedAt: 1760000000000 });
  assert.strictEqual(audio.summarizePolish(polish).polishedTrackCount, 3);
  polish = audio.applyPreset(polish, "studio");
  assert.strictEqual(polish.presetId, "studio");
  assert.strictEqual(polish.noiseCleanup, "strong");
  assert.strictEqual(polish.leveling, "strong");
  assert.strictEqual(polish.speechClarity, "strong");
  assert.strictEqual(polish.enhancement, "strong");
  assert.strictEqual(audio.summarizePolish(polish).polishedTrackCount, 0);
});

test("updateControl changes a single polish dimension", () => {
  const episode = setup.summarize(completeUploadDraft());
  let polish = audio.createPolish(episode);
  polish = audio.applyPolish(polish, { appliedAt: 1760000000000 });
  polish = audio.updateControl(polish, "noiseCleanup", "light");
  assert.strictEqual(polish.noiseCleanup, "light");
  assert.strictEqual(polish.leveling, "balanced");
  assert.strictEqual(audio.summarizePolish(polish).readyForReview, false);
});

test("summarizePolish reflects the chosen treatment", () => {
  const episode = setup.summarize(completeUploadDraft());
  const polish = audio.applyPreset(audio.createPolish(episode), "natural");
  const summary = audio.summarizePolish(polish);
  assert.strictEqual(summary.presetName, "Natural");
  assert.strictEqual(summary.noiseCleanupLabel, "Light");
  assert.ok(summary.treatmentLine.includes("Noise cleanup: Light"));
  assert.strictEqual(summary.speakerCount, 3);
  assert.strictEqual(summary.polishedTrackCount, 0);
});

test("applyPolish creates concrete polished outputs for every speaker", () => {
  const episode = setup.summarize(completeUploadDraft());
  let polish = audio.createPolish(episode);
  polish = audio.updateControl(polish, "speechClarity", "strong");
  polish = audio.applyPolish(polish, { appliedAt: 1760000000000 });
  const summary = audio.summarizePolish(polish);

  assert.strictEqual(summary.applied, true);
  assert.strictEqual(summary.polishedTrackCount, 3);
  assert.strictEqual(summary.readyForReview, true);
  assert.deepStrictEqual(
    summary.polishedTracks.map((track) => track.originalAssetId),
    ["source-media-1", "source-media-2", "source-media-3"],
  );
  assert.ok(summary.polishedTracks.every((track) => track.outputMedia && track.outputMedia.storage === "polished-track"));
  assert.ok(summary.polishedTracks.every((track) => track.treatment.controls.speechClarity === "strong"));
  assert.strictEqual(summary.polishedTracks[0].sourceMedia.assetId, "source-media-1");
});

test("buildReviewSummary requires polished outputs in the export path", () => {
  const episode = setup.summarize(completeUploadDraft());
  const unapplied = audio.summarizePolish(audio.createPolish(episode));
  const blocked = audio.buildReviewSummary(episode, unapplied, {});
  assert.strictEqual(blocked.readyForExport, false);

  const polish = audio.summarizePolish(audio.applyPolish(audio.createPolish(episode), { appliedAt: 1760000000000 }));
  const review = audio.buildReviewSummary(episode, polish, {
    styleName: "Studio Spotlight",
    templateName: "Founders Unfiltered",
  });
  assert.strictEqual(review.episodeName, "Founders Unfiltered #7");
  assert.strictEqual(review.audioPreset, "Clean");
  assert.strictEqual(review.polishedTrackCount, 3);
  assert.strictEqual(review.styleName, "Studio Spotlight");
  assert.strictEqual(review.readyForExport, true);
  assert.ok(review.summaryLines.some((line) => line.indexOf("Audio:") === 0 && line.includes("3 polished tracks")));
});

test("ACCEPTANCE: episode setup flows into audio polish and saves a review summary", () => {
  const draft = completeUploadDraft();
  assert.strictEqual(setup.validateDraft(draft).ok, true);

  const episode = setup.summarize(draft);
  let polish = audio.createPolish(episode);
  assert.strictEqual(polish.speakers.length, episode.speakerCount);

  polish = audio.applyPreset(polish, "clean");
  polish = audio.updateControl(polish, "speechClarity", "strong");
  polish = audio.applyPolish(polish, { appliedAt: 1760000000000 });
  const applied = audio.summarizePolish(polish);
  assert.strictEqual(applied.presetName, "Clean");
  assert.strictEqual(applied.speechClarityLabel, "Strong");
  assert.strictEqual(applied.polishedTrackCount, 3);

  const review = audio.buildReviewSummary(episode, applied, {});
  assert.strictEqual(review.readyForExport, true);
  assert.ok(review.audioTreatment.includes("Speech clarity: Strong"));
});

console.log(`\naudio polish: ${passed} assertions passed`);
