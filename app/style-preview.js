"use strict";

// Rich episode look previews for Podcast Design Canvas (#102).
//
// Builds demo-quality preset previews with realistic multi-speaker framing, captions,
// title treatment, overlays, and pacing cues. DOM-free so UI and tests share one model.
(function (global) {
  function styleApi() {
    if (typeof module !== "undefined" && module.exports && typeof require === "function") {
      return require("./episode-style.js");
    }
    const g = typeof window !== "undefined" ? window : globalThis;
    return g.PdcEpisodeStyle;
  }

  const SAMPLE_SPEAKERS = [
    { role: "Host", name: "Sam Rivera", initials: "SR", tile: "#5b4bff" },
    { role: "Guest 1", name: "Dana Kim", initials: "DK", tile: "#2bb9a9" },
    { role: "Guest 2", name: "Alex Chen", initials: "AC", tile: "#f0a030" },
    { role: "Guest 3", name: "Jordan Lee", initials: "JL", tile: "#ff6b6b" },
  ];

  const PRESET_OVERLAY = {
    "studio-spotlight": "LIVE",
    "split-stage": "Founders",
    "panel-grid": "Panel",
    "bold-broadcast": "ON AIR",
  };

  // Per-preset demo profiles so create-show previews read differently at a glance.
  const PRESET_PREVIEW = {
    "studio-spotlight": {
      pacing: "balanced",
      captionVariant: "lower-third",
      captionText: "The host leads while guests stay visible in the filmstrip.",
      speakerTiles: ["#5b4bff", "#2bb9a9", "#f0a030"],
      frameCount: 3,
    },
    "split-stage": {
      pacing: "relaxed",
      captionVariant: "bar",
      captionText: "Two voices, equal weight — calm side-by-side conversation.",
      speakerTiles: ["#c45c26", "#1f6f8b"],
      frameCount: 2,
    },
    "panel-grid": {
      pacing: "balanced",
      captionVariant: "name-tag",
      captionText: "Everyone stays on screen in a balanced panel grid.",
      speakerTiles: ["#4dd0e1", "#7c4dff", "#f0a030", "#ff6b6b"],
      frameCount: 4,
    },
    "bold-broadcast": {
      pacing: "punchy",
      captionVariant: "broadcast",
      captionText: "THIS WEEK: SHIP THE STORY BEFORE THE POLISH IS PERFECT.",
      speakerTiles: ["#ff5d8f", "#ffd166", "#06d6a0"],
      frameCount: 3,
    },
  };

  function presetPreviewProfile(presetId) {
    return PRESET_PREVIEW[presetId] || PRESET_PREVIEW["studio-spotlight"];
  }

  function trim(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function sampleEpisodeSummary(showName) {
    const title = trim(showName) || "Founders Unfiltered";
    return {
      episodeName: `${title} · Episode 12`,
      showName: title,
      speakers: SAMPLE_SPEAKERS.map((speaker) => Object.assign({}, speaker)),
      speakerCount: SAMPLE_SPEAKERS.length,
    };
  }

  function initialsForName(name) {
    const parts = trim(name).split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return "?";
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function buildPreviewFrames(preset, speakers, layoutId, profile, options) {
    const previewProfile = profile || presetPreviewProfile(preset.id);
    const opts = options || {};
    const limit = opts.useDemoFrameCount
      ? (previewProfile.frameCount || speakers.length)
      : speakers.length;
    const source = speakers.slice(0, limit);
    let activeIndex = source.findIndex((speaker) => /host/i.test(speaker.role));
    if (activeIndex < 0 && source.length) {
      activeIndex = 0;
    }
    return source.map((speaker, index) => ({
      role: speaker.role,
      name: speaker.name,
      initials: speaker.initials || initialsForName(speaker.name),
      tile: previewProfile.speakerTiles[index] || speaker.tile,
      active: layoutId === "spotlight" ? index === activeIndex : false,
    }));
  }

  function buildEpisodeLook(presetId, options) {
    const STY = styleApi();
    const opts = options || {};
    const preset = STY ? STY.getPreset(presetId) : null;
    if (!preset) {
      return null;
    }
    const profile = presetPreviewProfile(preset.id);
    const summary = sampleEpisodeSummary(opts.showName);
    const selection = {
      presetId: preset.id,
      layout: preset.defaultLayout,
      pacing: opts.pacing || profile.pacing,
    };
    const layoutId = STY.resolveLayout(selection, profile.frameCount || summary.speakerCount);
    const frames = buildPreviewFrames(preset, summary.speakers, layoutId, profile, { useDemoFrameCount: true });
    const pacing = STY.getPacing(selection.pacing);
    return {
      presetId: preset.id,
      presetName: preset.name,
      tagline: preset.tagline,
      layoutId: layoutId,
      layoutLabel: STY.getLayout(layoutId).label,
      pacingLabel: pacing.label,
      captionStyle: preset.captionStyle,
      captionVariant: profile.captionVariant,
      formatCue: STY.presetCardSummary(preset).formatCue,
      episodeTitle: summary.episodeName,
      showName: summary.showName,
      captionText: profile.captionText,
      overlayLabel: PRESET_OVERLAY[preset.id] || preset.name.split(" ")[0].toUpperCase(),
      theme: {
        background: preset.background,
        surface: preset.surface,
        accent: preset.accent,
        textColor: preset.textColor,
      },
      frames: frames,
    };
  }

  function buildEpisodeLookFromEpisode(presetId, summary, selection) {
    const STY = styleApi();
    const episode = summary || {};
    const sel = selection || {};
    const preset = STY ? STY.getPreset(presetId || sel.presetId) : null;
    if (!preset) {
      return null;
    }
    const profile = presetPreviewProfile(preset.id);
    const mergedSelection = {
      presetId: preset.id,
      layout: sel.layout || preset.defaultLayout,
      pacing: sel.pacing || profile.pacing,
    };
    const speakers = Array.isArray(episode.speakers) && episode.speakers.length
      ? episode.speakers
      : SAMPLE_SPEAKERS;
    const speakerCount = episode.speakerCount || speakers.length;
    const layoutId = STY.resolveLayout(mergedSelection, speakerCount);
    const mappedSpeakers = speakers.map((speaker, index) => {
      const sample = SAMPLE_SPEAKERS[index] || SAMPLE_SPEAKERS[0];
      const name = trim(speaker && speaker.name) || sample.name;
      return {
        role: (speaker && speaker.role) || sample.role,
        name: name,
        initials: initialsForName(name),
        tile: sample.tile,
      };
    });
    const frames = buildPreviewFrames(preset, mappedSpeakers, layoutId, profile, { useDemoFrameCount: false });
    const pacing = STY.getPacing(mergedSelection.pacing);
    const showName = trim(episode.episodeName).split("·")[0].trim() || "Your show";
    return {
      presetId: preset.id,
      presetName: preset.name,
      tagline: preset.tagline,
      layoutId: layoutId,
      layoutLabel: STY.getLayout(layoutId).label,
      pacingLabel: pacing.label,
      captionStyle: preset.captionStyle,
      captionVariant: profile.captionVariant,
      formatCue: STY.presetCardSummary(preset).formatCue,
      episodeTitle: trim(episode.episodeName) || `${showName} · Episode 1`,
      showName: showName,
      captionText: profile.captionText,
      overlayLabel: PRESET_OVERLAY[preset.id] || preset.name.split(" ")[0].toUpperCase(),
      theme: {
        background: preset.background,
        surface: preset.surface,
        accent: preset.accent,
        textColor: preset.textColor,
      },
      frames: frames,
    };
  }

  const api = {
    SAMPLE_SPEAKERS,
    PRESET_OVERLAY,
    PRESET_PREVIEW,
    presetPreviewProfile,
    sampleEpisodeSummary,
    buildEpisodeLook,
    buildEpisodeLookFromEpisode,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  global.PdcStylePreview = api;
}(typeof window !== "undefined" ? window : globalThis));
