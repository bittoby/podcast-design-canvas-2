"use strict";

// Speaker name integrity through social context (#172).
// Run with: `node tests/speaker-name-integrity.test.js`.

const assert = require("assert");
const setup = require("../app/episode-setup.js");
const style = require("../app/episode-style.js");
const audio = require("../app/audio-polish.js");
const moments = require("../app/visual-moments.js");
const context = require("../app/social-context.js");
const correction = require("../app/transcript-correction.js");
const exportApi = require("../app/episode-export.js");
const editor = require("../app/canvas-editor.js");
const templates = require("../app/show-templates.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

function samRiveraDraft() {
  const draft = setup.createDraft();
  draft.episodeName = "Founders Unfiltered #7";
  draft.sourceMode = "upload";
  draft.speakers = [
    Object.assign(setup.createSpeaker("Host"), {
      name: "Sam Rivera",
      fileName: "sam.mp4",
      social: {
        website: "https://samrivera.show",
        twitter: "https://x.com/samrivera",
        instagram: "",
        linkedin: "",
      },
    }),
    Object.assign(setup.createSpeaker("Guest 1"), {
      name: "Dana Kim",
      fileName: "dana.mp4",
      social: {
        website: "",
        twitter: "",
        instagram: "",
        linkedin: "https://linkedin.com/in/danakim",
      },
    }),
    Object.assign(setup.createSpeaker("Guest 2"), { name: "Alex Chen", fileName: "alex.mp4" }),
  ];
  return draft;
}

test("spellingHints never emit prefix variants that corrupt confirmed names", () => {
  const hints = context.deriveSpeakerContext({ role: "Host", name: "Sam Rivera" }).spellingHints;
  assert.ok(!hints.includes("Sam Rivera"));
  assert.ok(!hints.includes("Sam River"));
  assert.strictEqual(context.applyHintsToText("Sam Rivera", {
    approved: true,
    speakers: [{ role: "Host", displayName: "Sam Rivera", spellingHints: hints, topics: [], brand: "" }],
  }, "Host", "Sam Rivera"), "Sam Rivera");
});

test("applyHintsToText fixes transcript misspellings without corrupting confirmed names", () => {
  let review = context.createReview(setup.summarize(samRiveraDraft()));
  review = context.updateSpeaker(review, 0, {
    spellingHints: "Sam River, Sam Rivira",
  });
  review = context.approveReview(review);
  assert.ok(!review.speakers[0].spellingHints.includes("Sam River"));
  assert.ok(review.speakers[0].spellingHints.includes("Sam Rivira"));

  const fixed = context.applyHintsToText(
    "Sam Rivira on building in public",
    review,
    "Host",
    "Sam Rivera",
  );
  assert.ok(fixed.includes("Sam Rivera"));
  assert.ok(!fixed.includes("Sam Rivira"));
  assert.ok(!fixed.includes("Sam Riveraa"));

  const intact = context.applyHintsToText(
    "Sam Rivera on building in public",
    review,
    "Host",
    "Sam Rivera",
  );
  assert.strictEqual(intact, "Sam Rivera on building in public");
});

test("ACCEPTANCE: confirmed setup names survive context, correction, templates, and export", () => {
  const draft = samRiveraDraft();
  const episode = setup.summarize(draft);
  assert.strictEqual(episode.speakers[0].name, "Sam Rivera");

  let review = context.createReview(episode);
  review = context.approveReview(review);
  assert.strictEqual(review.speakers[0].displayName, "Sam Rivera");

  let board = moments.createBoard(episode);
  board = moments.addMoment(board, "caption", {
    time: "0:30",
    text: "Sam Rivera and Dana Kim discuss founders",
    speakerRole: "Host",
    speakerName: "Sam Rivera",
  });
  board = context.applyReviewToMoments(board, review);
  const caption = board.moments.find((moment) => moment.type === "caption");
  assert.ok(caption.text.includes("Sam Rivera"));
  assert.ok(!caption.text.includes("Sam Riveraa"));
  assert.strictEqual(caption.speakerName, "Sam Rivera");

  const selection = style.createSelection();
  const appliedStyle = style.summarizeStyle(selection, episode.speakerCount);
  let canvasDoc = editor.createFromStyle(appliedStyle, episode, selection);
  canvasDoc = editor.updateElement(canvasDoc, "captionText", "Sam Rivera welcomes listeners");
  canvasDoc = context.applyReviewToCanvas(canvasDoc, review);
  assert.strictEqual(canvasDoc.captionText, "Sam Rivera welcomes listeners");
  assert.strictEqual(canvasDoc.speakerFrames[0].name, "Sam Rivera");

  let correctionReview = correction.createCorrectionReview(episode, {
    contextReview: review,
    momentsBoard: board,
  });
  correctionReview = correction.approveCorrection(correctionReview);
  const applied = correction.applyCorrectionReview(correctionReview, {
    momentsBoard: board,
    canvasDoc: canvasDoc,
    speakers: draft.speakers,
  });
  assert.strictEqual(applied.speakers[0].name, "Sam Rivera");
  assert.strictEqual(applied.canvasDoc.speakerFrames[0].name, "Sam Rivera");

  const template = templates.createTemplate("Founders Look", canvasDoc, undefined, "show-1");
  const stored = templates.saveTemplate(templates.createStore(), template);
  const loaded = templates.getTemplate(stored, template.id);
  assert.strictEqual(loaded.canvas.speakerFrames[0].name, "Sam Rivera");

  const exportCtx = {
    audioPolish: audio.summarizePolish(audio.createPolish(episode)),
    appliedStyle: appliedStyle,
    templateName: loaded.name,
    momentsSummary: moments.summarizeBoard(applied.momentsBoard),
    contextSummary: context.summarizeReview(review),
    correctionSummary: correction.summarizeCorrection(correctionReview),
  };
  const job = exportApi.createExport(episode);
  const finalSummary = exportApi.buildFinalSummary(episode, exportCtx, job);
  assert.ok(finalSummary.lines.some((line) => line.includes("Sam Rivera")));
  assert.ok(!finalSummary.lines.some((line) => line.includes("Sam Riveraa")));
});

console.log(`\nspeaker name integrity: ${passed} test(s) passed.`);
