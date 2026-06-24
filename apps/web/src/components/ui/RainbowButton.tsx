/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the shared styles for an animated rainbow gradient-border call-to-action.
*/

export const rainbowGradient =
  "linear-gradient(90deg, var(--rainbow-1), var(--rainbow-2), var(--rainbow-3), var(--rainbow-4), var(--rainbow-5), var(--rainbow-1))";

// Outer frame: the animated gradient is the visible border, revealed by a 1.5px pad
// around the inner fill. Apply `style={{ backgroundImage: rainbowGradient }}`.
export const rainbowFrame =
  "group relative inline-flex animate-rainbow rounded-lg bg-[length:200%] p-[1.5px] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#100D16] active:translate-y-px";

// Inner fill matches the panel so only the gradient border shows.
export const rainbowFill =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[6.5px] bg-[#100D16] px-6 text-sm font-semibold";

// Gradient-clipped text. Apply `style={{ backgroundImage: rainbowGradient }}`.
export const rainbowText = "animate-rainbow bg-[length:200%] bg-clip-text text-transparent";
