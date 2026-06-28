"use strict";

// Creator-facing audio polish model for Podcast Design Canvas (#15).
//
// Presents noise cleanup, leveling, speech clarity, and enhancement as simple quality
// choices tied to each imported speaker track — not technical audio processing settings.
// DOM-free so the polish step and tests share one source of truth.
(function (global) {
  const QUALITY_PRESETS = [
    {
      id: "natural",
      name: "Natural",
      tagline: "Light touch — keeps the room feel with gentle cleanup.",
    },
    {
      id: "clean",
      name: "Clean",
      tagline: "Balanced polish for most podcast conversations.",
    },
    {
      id: "studio",
      name: "Studio",
      tagline: "Broadcast-ready clarity and presence.",
    },
  ];

  const CONTROLS = [
    {
      id: "noiseCleanup",
      label: "Noise cleanup",
      hint: "Reduce background hum, fan noise, and room rumble.",
    },
    {
      id: "leveling",
      label: "Voice leveling",
      hint: "Even out volume between speakers and moments.",
    },
    {
      id: "speechClarity",
      label: "Speech clarity",
      hint: "Bring forward consonants and vocal presence.",
    },
    {
      id: "enhancement",
      label: "Overall enhancement",
      hint: "Add warmth and polish without sounding overprocessed.",
    },
  ];

  const LEVELS = [
    { id: "light", label: "Light" },
    { id: "balanced", label: "Balanced" },
    { id: "strong", label: "Strong" },
  ];

  const PRESET_LEVELS = {
    natural: {
      noiseCleanup: "light",
      leveling: "light",
      speechClarity: "light",
      enhancement: "light",
    },
    clean: {
      noiseCleanup: "balanced",
      leveling: "balanced",
      speechClarity: "balanced",
      enhancement: "balanced",
    },
    studio: {
      noiseCleanup: "strong",
      leveling: "strong",
      speechClarity: "strong",
      enhancement: "strong",
    },
  };

  function defaultPreset() {
    return QUALITY_PRESETS[1];
  }

  function getPreset(id) {
    return QUALITY_PRESETS.find((preset) => preset.id === id) || defaultPreset();
  }

  function getLevel(id) {
    return LEVELS.find((level) => level.id === id) || LEVELS[1];
  }

  function getControl(id) {
    return CONTROLS.find((control) => control.id === id) || CONTROLS[0];
  }

  function buildSpeakerTracks(episodeSummary) {
    const sourceMode = episodeSummary && episodeSummary.sourceMode ? episodeSummary.sourceMode : "";
    const speakers = episodeSummary && Array.isArray(episodeSummary.speakers)
      ? episodeSummary.speakers
      : [];
    return speakers.map((speaker, index) => {
      const sourceMedia = speaker && speaker.sourceMedia && typeof speaker.sourceMedia === "object"
        ? speaker.sourceMedia
        : null;
      const byteLength = sourceMedia ? Number(sourceMedia.byteLength) || 0 : 0;
      const assetId = sourceMedia ? sourceMedia.assetId || sourceMedia.id || "" : "";
      return {
        role: (speaker && speaker.role) || "Speaker",
        name: (speaker && speaker.name) || "Unnamed speaker",
        sourceLabel: (speaker && speaker.sourceLabel) || "Source track",
        sourceMode: sourceMode,
        sourceMedia: sourceMedia,
        hasSourceMedia: Boolean(sourceMedia && assetId && byteLength > 0),
        trackIndex: index + 1,
      };
    });
  }

  function clearAppliedOutput(polish) {
    const next = Object.assign({}, polish || createPolish({}));
    next.applied = false;
    next.appliedAt = null;
    next.polishedTracks = [];
    next.outputTrackCount = 0;
    return next;
  }

  function createPolish(episodeSummary) {
    const preset = defaultPreset();
    const levels = PRESET_LEVELS[preset.id];
    return {
      presetId: preset.id,
      noiseCleanup: levels.noiseCleanup,
      leveling: levels.leveling,
      speechClarity: levels.speechClarity,
      enhancement: levels.enhancement,
      speakers: buildSpeakerTracks(episodeSummary),
      applied: false,
      appliedAt: null,
      polishedTracks: [],
      outputTrackCount: 0,
    };
  }

  function applyPreset(polish, presetId) {
    const preset = getPreset(presetId);
    const levels = PRESET_LEVELS[preset.id] || PRESET_LEVELS.clean;
    return clearAppliedOutput(Object.assign({}, polish || createPolish({}), {
      presetId: preset.id,
      noiseCleanup: levels.noiseCleanup,
      leveling: levels.leveling,
      speechClarity: levels.speechClarity,
      enhancement: levels.enhancement,
      speakers: polish && polish.speakers ? polish.speakers.slice() : [],
    }));
  }

  function updateControl(polish, controlId, levelId) {
    const next = Object.assign({}, polish || createPolish({}));
    if (CONTROLS.some((control) => control.id === controlId)) {
      next[controlId] = getLevel(levelId).id;
    }
    return clearAppliedOutput(next);
  }

  function safeStem(value) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    const stem = trimmed.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
    return stem || "speaker-track";
  }

  function controlSummaryEntries(polish) {
    const state = polish || createPolish({});
    return CONTROLS.map((control) => {
      const level = getLevel(state[control.id]);
      return {
        id: control.id,
        label: control.label,
        levelId: level.id,
        levelLabel: level.label,
      };
    });
  }

  function treatmentSnapshot(polish) {
    const state = polish || createPolish({});
    const preset = getPreset(state.presetId);
    const controls = {};
    const labels = controlSummaryEntries(state);
    labels.forEach((entry) => {
      controls[entry.id] = entry.levelId;
    });
    return {
      presetId: preset.id,
      presetName: preset.name,
      controls,
      controlLabels: labels,
      treatmentLine: labels.map((entry) => `${entry.label}: ${entry.levelLabel}`).join(" · "),
    };
  }

  function outputByteLength(sourceMedia) {
    if (!sourceMedia) {
      return 0;
    }
    return Number(sourceMedia.byteLength || sourceMedia.fileSize) || 0;
  }

  function buildPolishedTrack(track, polish, appliedAt) {
    const speaker = track || {};
    const treatment = treatmentSnapshot(polish);
    const sourceMedia = speaker.sourceMedia && typeof speaker.sourceMedia === "object"
      ? Object.assign({}, speaker.sourceMedia)
      : null;
    const sourceAssetId = sourceMedia ? sourceMedia.assetId || sourceMedia.id || "" : "";
    const sourceStem = safeStem(speaker.name || speaker.sourceLabel || speaker.role);
    const sourceSignature = sourceAssetId || `${speaker.sourceMode || "source"}-${speaker.trackIndex || 0}-${safeStem(speaker.sourceLabel)}`;
    const outputAssetId = [
      "polished",
      speaker.trackIndex || 0,
      safeStem(sourceSignature),
      treatment.presetId,
      safeStem(Object.keys(treatment.controls).map((key) => treatment.controls[key]).join("-")),
      appliedAt,
    ].join("-");
    return {
      id: outputAssetId,
      trackIndex: speaker.trackIndex || 0,
      role: speaker.role || "Speaker",
      name: speaker.name || "Unnamed speaker",
      sourceLabel: speaker.sourceLabel || "Source track",
      sourceMode: speaker.sourceMode || "",
      sourceMedia: sourceMedia,
      originalAssetId: sourceAssetId,
      outputMedia: {
        assetId: outputAssetId,
        fileName: `${sourceStem}-${treatment.presetId}-polished.wav`,
        mimeType: "audio/wav",
        byteLength: outputByteLength(sourceMedia),
        storage: "polished-track",
        derivedFromAssetId: sourceAssetId,
        createdAt: appliedAt,
      },
      treatment,
      status: "ready",
    };
  }

  function applyPolish(polish, options) {
    const state = polish || createPolish({});
    const opts = options || {};
    const appliedAt = Number(opts.appliedAt) || Date.now();
    const speakers = Array.isArray(state.speakers) ? state.speakers : [];
    const polishedTracks = speakers.map((track) => buildPolishedTrack(track, state, appliedAt));
    return Object.assign({}, state, {
      applied: true,
      appliedAt,
      polishedTracks,
      outputTrackCount: polishedTracks.length,
    });
  }

  function polishedTrackCount(polish) {
    const tracks = polish && Array.isArray(polish.polishedTracks) ? polish.polishedTracks : [];
    return tracks.filter((track) => track && track.status === "ready" && track.outputMedia && track.outputMedia.assetId).length;
  }

  function hasPolishedTracks(polish, expectedCount) {
    const count = polishedTrackCount(polish);
    const expected = Number(expectedCount) || Number(polish && polish.speakerCount) || 0;
    return count > 0 && (!expected || count >= expected);
  }

  function speakerIndicator(polish, speaker) {
    const preset = getPreset(polish && polish.presetId);
    const name = (speaker && speaker.name) || "Speaker";
    const tracks = polish && Array.isArray(polish.polishedTracks) ? polish.polishedTracks : [];
    const output = tracks.find((track) => track && track.trackIndex === speaker.trackIndex);
    if (output && output.outputMedia && output.outputMedia.fileName) {
      return `${preset.name} treatment · ${name} · polished output ready`;
    }
    const sourceCue = speaker && speaker.sourceMode === "upload"
      ? (speaker.hasSourceMedia ? "source media saved" : "source media pending")
      : "source linked";
    return `${preset.name} treatment · ${name} · ${sourceCue}`;
  }

  function summarizePolish(polish) {
    const state = polish || createPolish({});
    const preset = getPreset(state.presetId);
    const treatment = treatmentSnapshot(state);
    const speakers = Array.isArray(state.speakers) ? state.speakers : [];
    const sourceMediaCount = speakers.reduce((total, speaker) => total + (speaker && speaker.hasSourceMedia ? 1 : 0), 0);
    const polishedTracks = Array.isArray(state.polishedTracks) ? state.polishedTracks.slice() : [];
    const outputCount = polishedTrackCount({ polishedTracks });
    return {
      presetId: preset.id,
      presetName: preset.name,
      tagline: preset.tagline,
      noiseCleanup: state.noiseCleanup,
      noiseCleanupLabel: getLevel(state.noiseCleanup).label,
      leveling: state.leveling,
      levelingLabel: getLevel(state.leveling).label,
      speechClarity: state.speechClarity,
      speechClarityLabel: getLevel(state.speechClarity).label,
      enhancement: state.enhancement,
      enhancementLabel: getLevel(state.enhancement).label,
      speakerCount: speakers.length,
      sourceMediaCount,
      sourceMediaReady: speakers.length > 0 && sourceMediaCount === speakers.length,
      applied: Boolean(state.applied && outputCount > 0),
      appliedAt: state.appliedAt || null,
      polishedTracks,
      polishedTrackCount: outputCount,
      outputTrackCount: outputCount,
      readyForReview: hasPolishedTracks({ polishedTracks, speakerCount: speakers.length }, speakers.length),
      treatmentLine: treatment.treatmentLine,
      polishedTrackLine: outputCount
        ? `${outputCount} polished track${outputCount === 1 ? "" : "s"} ready`
        : "No polished tracks created yet",
    };
  }

  // Episode review / export path — rolls audio treatment up with other episode choices.
  function buildReviewSummary(episodeSummary, polishSummary, extras) {
    const episode = episodeSummary || {};
    const audio = polishSummary || {};
    const options = extras || {};
    const lines = [];
    if (audio.presetName) {
      const outputLine = audio.polishedTrackCount
        ? ` · ${audio.polishedTrackCount} polished track${audio.polishedTrackCount === 1 ? "" : "s"}`
        : "";
      lines.push(`Audio: ${audio.presetName} (${audio.treatmentLine})${outputLine}`);
    }
    if (options.styleName) {
      lines.push(`Visual style: ${options.styleName}`);
    }
    if (options.templateName) {
      lines.push(`Show template: ${options.templateName}`);
    }
    return {
      episodeName: episode.episodeName || "",
      speakerCount: episode.speakerCount || 0,
      audioPreset: audio.presetName || "",
      audioTreatment: audio.treatmentLine || "",
      polishedTrackCount: audio.polishedTrackCount || 0,
      styleName: options.styleName || "",
      templateName: options.templateName || "",
      readyForExport: Boolean(audio.presetName && hasPolishedTracks(audio, audio.speakerCount || episode.speakerCount)),
      summaryLines: lines,
    };
  }

  const api = {
    QUALITY_PRESETS,
    CONTROLS,
    LEVELS,
    defaultPreset,
    getPreset,
    getLevel,
    getControl,
    buildSpeakerTracks,
    createPolish,
    applyPreset,
    updateControl,
    applyPolish,
    polishedTrackCount,
    hasPolishedTracks,
    speakerIndicator,
    summarizePolish,
    buildReviewSummary,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  global.PdcAudioPolish = api;
}(typeof window !== "undefined" ? window : globalThis));
