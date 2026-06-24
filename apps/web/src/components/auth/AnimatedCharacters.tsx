/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders the mouse-aware animated characters shown beside the authentication form.
*/
import { useEffect, useRef, useState, type RefObject } from "react";

const PALETTE = {
  violet: "#6C3FF5",
  periwinkle: "#9D7BF4",
  lilac: "#ECE7FB",
  mauve: "#C9A9EC",
  blush: "#FF9DB0",
  ink: "#241F2E",
  white: "#FFFFFF",
};

interface EyeProps {
  size: number;
  pupilSize: number;
  maxDistance: number;
  lid: number; // 0 = fully shut, 1 = fully open
  forceLookX?: number;
  forceLookY?: number;
}

function useMouse() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return pos;
}

function offsetToward(
  ref: RefObject<HTMLDivElement | null>,
  mouse: { x: number; y: number },
  maxDistance: number,
) {
  if (!ref.current) return { x: 0, y: 0 };
  const rect = ref.current.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = mouse.x - cx;
  const dy = mouse.y - cy;
  const distance = Math.min(Math.hypot(dx, dy), maxDistance);
  const angle = Math.atan2(dy, dx);
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

function Eye({ size, pupilSize, maxDistance, lid, forceLookX, forceLookY }: EyeProps) {
  const mouse = useMouse();
  const ref = useRef<HTMLDivElement>(null);
  const forced = forceLookX !== undefined && forceLookY !== undefined;
  const offset = forced ? { x: forceLookX, y: forceLookY } : offsetToward(ref, mouse, maxDistance);
  const height = Math.max(2, size * lid);
  const pupilVisible = lid > 0.22;

  return (
    <div
      ref={ref}
      className="flex items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height,
        backgroundColor: PALETTE.white,
        transition: "height 0.16s ease-out",
      }}
    >
      <div
        className="rounded-full"
        style={{
          width: pupilSize,
          height: pupilSize,
          backgroundColor: PALETTE.ink,
          opacity: pupilVisible ? 1 : 0,
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          transition: "transform 0.1s ease-out, opacity 0.12s ease-out",
        }}
      />
    </div>
  );
}

function useBlink() {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(
        () => {
          setBlinking(true);
          setTimeout(() => {
            setBlinking(false);
            schedule();
          }, 140);
        },
        Math.random() * 4000 + 3000,
      );
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);
  return blinking;
}

function useFaceLean(ref: RefObject<HTMLDivElement | null>, mouse: { x: number; y: number }) {
  if (!ref.current) return { faceX: 0, faceY: 0, skew: 0 };
  const rect = ref.current.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 3;
  const dx = mouse.x - cx;
  const dy = mouse.y - cy;
  return {
    faceX: Math.max(-15, Math.min(15, dx / 20)),
    faceY: Math.max(-10, Math.min(10, dy / 30)),
    skew: Math.max(-6, Math.min(6, -dx / 120)),
  };
}

/**
 * Eye behaviour while a password is being entered, expressed as a continuous lid fraction.
 * - Hidden password: lids stay shut and lift into a slow recurring "peek" then settle again.
 * - Revealed password: lids open, watching the form, with an occasional wider, leaning peek.
 */
function usePasswordEyes(passwordLength: number, revealed: boolean) {
  const active = passwordLength > 0;
  const [phase, setPhase] = useState<"rest" | "peek">("rest");

  useEffect(() => {
    if (!active) {
      setPhase("rest");
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const loop = (next: "rest" | "peek") => {
      setPhase(next);
      const hold =
        next === "peek"
          ? (revealed ? 1100 : 620) + Math.random() * 300
          : (revealed ? 1400 : 1700) + Math.random() * 1200;
      timer = setTimeout(() => loop(next === "peek" ? "rest" : "peek"), hold);
    };
    timer = setTimeout(() => loop("peek"), 900);
    return () => clearTimeout(timer);
  }, [active, revealed]);

  if (!active) {
    return {
      engaged: false,
      lid: 1,
      lookX: undefined as number | undefined,
      lookY: undefined as number | undefined,
    };
  }
  if (revealed) {
    // Watching the typed password: open, peek a touch wider and lean toward it.
    return {
      engaged: true,
      lid: phase === "peek" ? 1 : 0.82,
      lookX: phase === "peek" ? -5 : -4,
      lookY: phase === "peek" ? 5 : 3,
    };
  }
  // Hidden: shut, then lift to a half "peek" and settle.
  return {
    engaged: true,
    lid: phase === "peek" ? 0.5 : 0.06,
    lookX: phase === "peek" ? -4 : undefined,
    lookY: phase === "peek" ? 3 : undefined,
  };
}

export function AnimatedCharacters({
  typing,
  passwordLength,
  revealed,
}: {
  typing: boolean;
  passwordLength: number;
  revealed: boolean;
}) {
  const mouse = useMouse();
  const violetBlink = useBlink();
  const tealBlink = useBlink();
  const pw = usePasswordEyes(passwordLength, revealed);

  const violetRef = useRef<HTMLDivElement>(null);
  const tealRef = useRef<HTMLDivElement>(null);
  const archRef = useRef<HTMLDivElement>(null);
  const amberRef = useRef<HTMLDivElement>(null);

  const [glance, setGlance] = useState(false);
  useEffect(() => {
    if (!typing) {
      setGlance(false);
      return;
    }
    setGlance(true);
    const timer = setTimeout(() => setGlance(false), 800);
    return () => clearTimeout(timer);
  }, [typing]);

  const violet = useFaceLean(violetRef, mouse);
  const teal = useFaceLean(tealRef, mouse);
  const arch = useFaceLean(archRef, mouse);
  const amber = useFaceLean(amberRef, mouse);

  const engaged = pw.engaged;
  const tallHeightBoost = passwordLength > 0 && !revealed;
  const lidFor = (blink: boolean) => (engaged ? pw.lid : blink ? 0 : 1);

  return (
    <div className="relative" style={{ width: 520, height: 380 }}>
      {/* Violet operator, back, wearing a soft beanie */}
      <div
        ref={violetRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 70,
          width: 170,
          height: typing || tallHeightBoost ? 410 : 376,
          backgroundColor: PALETTE.violet,
          borderRadius: "18px 18px 0 0",
          zIndex: 1,
          transform: engaged
            ? "skewX(0deg)"
            : typing || tallHeightBoost
              ? `skewX(${violet.skew - 12}deg) translateX(36px)`
              : `skewX(${violet.skew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-7 transition-all duration-700 ease-in-out"
          style={{
            left: engaged ? 44 : glance ? 52 : 42 + violet.faceX,
            top: engaged ? 44 : glance ? 62 : 40 + violet.faceY,
          }}
        >
          <Eye
            size={19}
            pupilSize={7}
            maxDistance={5}
            lid={lidFor(violetBlink)}
            forceLookX={engaged ? pw.lookX : glance ? 3 : undefined}
            forceLookY={engaged ? pw.lookY : glance ? 4 : undefined}
          />
          <Eye
            size={19}
            pupilSize={7}
            maxDistance={5}
            lid={lidFor(violetBlink)}
            forceLookX={engaged ? pw.lookX : glance ? 3 : undefined}
            forceLookY={engaged ? pw.lookY : glance ? 4 : undefined}
          />
        </div>
        <div
          className="pointer-events-none absolute flex transition-all duration-700 ease-in-out"
          style={{
            gap: 46,
            left: engaged ? 36 : glance ? 44 : 34 + violet.faceX,
            top: engaged ? 70 : glance ? 88 : 66 + violet.faceY,
          }}
        >
          <span
            style={{
              width: 16,
              height: 9,
              borderRadius: 9999,
              backgroundColor: PALETTE.blush,
              opacity: 0.5,
            }}
          />
          <span
            style={{
              width: 16,
              height: 9,
              borderRadius: 9999,
              backgroundColor: PALETTE.blush,
              opacity: 0.5,
            }}
          />
        </div>
      </div>

      {/* Periwinkle character, middle */}
      <div
        ref={tealRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 230,
          width: 118,
          height: 300,
          backgroundColor: PALETTE.periwinkle,
          borderRadius: "16px 16px 0 0",
          zIndex: 2,
          transform: engaged
            ? "skewX(0deg)"
            : glance
              ? `skewX(${teal.skew * 1.5 + 10}deg) translateX(18px)`
              : `skewX(${teal.skew * 1.5}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-2.5 transition-all duration-700 ease-in-out"
          style={{
            left: engaged ? 18 : glance ? 30 : 24 + teal.faceX,
            top: engaged ? 36 : glance ? 16 : 36 + teal.faceY,
          }}
        >
          <Eye
            size={15}
            pupilSize={6}
            maxDistance={4}
            lid={lidFor(tealBlink)}
            forceLookX={engaged ? pw.lookX : glance ? 0 : undefined}
            forceLookY={engaged ? pw.lookY : glance ? -4 : undefined}
          />
          <Eye
            size={15}
            pupilSize={6}
            maxDistance={4}
            lid={lidFor(tealBlink)}
            forceLookX={engaged ? pw.lookX : glance ? 0 : undefined}
            forceLookY={engaged ? pw.lookY : glance ? -4 : undefined}
          />
        </div>
        <div
          className="pointer-events-none absolute flex transition-all duration-700 ease-in-out"
          style={{
            gap: 30,
            left: engaged ? 12 : glance ? 24 : 18 + teal.faceX,
            top: engaged ? 56 : glance ? 38 : 56 + teal.faceY,
          }}
        >
          <span
            style={{
              width: 12,
              height: 7,
              borderRadius: 9999,
              backgroundColor: PALETTE.blush,
              opacity: 0.6,
            }}
          />
          <span
            style={{
              width: 12,
              height: 7,
              borderRadius: 9999,
              backgroundColor: PALETTE.blush,
              opacity: 0.6,
            }}
          />
        </div>
      </div>

      {/* Lilac guardian, front left arch, with a shield crest */}
      <div
        ref={archRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 0,
          width: 228,
          height: 188,
          zIndex: 3,
          backgroundColor: PALETTE.lilac,
          borderRadius: "114px 114px 0 0",
          transform: engaged ? "skewX(0deg)" : `skewX(${arch.skew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="pointer-events-none absolute flex transition-all duration-200 ease-out"
          style={{
            gap: 52,
            left: engaged ? 60 : 68 + arch.faceX,
            top: engaged ? 96 : 98 + arch.faceY,
          }}
        >
          <span
            style={{
              width: 14,
              height: 8,
              borderRadius: 9999,
              backgroundColor: PALETTE.blush,
              opacity: 0.55,
            }}
          />
          <span
            style={{
              width: 14,
              height: 8,
              borderRadius: 9999,
              backgroundColor: PALETTE.blush,
              opacity: 0.55,
            }}
          />
        </div>
        <div
          className="absolute flex gap-7 transition-all duration-200 ease-out"
          style={{ left: engaged ? 70 : 78 + arch.faceX, top: engaged ? 82 : 84 + arch.faceY }}
        >
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            lid={engaged ? pw.lid : 1}
            forceLookX={engaged ? pw.lookX : undefined}
            forceLookY={engaged ? pw.lookY : undefined}
          />
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            lid={engaged ? pw.lid : 1}
            forceLookX={engaged ? pw.lookX : undefined}
            forceLookY={engaged ? pw.lookY : undefined}
          />
        </div>
      </div>

      {/* Mauve character, front right */}
      <div
        ref={amberRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 300,
          width: 132,
          height: 218,
          backgroundColor: PALETTE.mauve,
          borderRadius: "66px 66px 0 0",
          zIndex: 4,
          transform: engaged ? "skewX(0deg)" : `skewX(${amber.skew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-3 transition-all duration-200 ease-out"
          style={{ left: engaged ? 42 : 48 + amber.faceX, top: engaged ? 38 : 40 + amber.faceY }}
        >
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            lid={engaged ? pw.lid : 1}
            forceLookX={engaged ? pw.lookX : undefined}
            forceLookY={engaged ? pw.lookY : undefined}
          />
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            lid={engaged ? pw.lid : 1}
            forceLookX={engaged ? pw.lookX : undefined}
            forceLookY={engaged ? pw.lookY : undefined}
          />
        </div>
        <div
          className="pointer-events-none absolute flex transition-all duration-200 ease-out"
          style={{ gap: 40, left: engaged ? 30 : 36 + amber.faceX, top: 64 + amber.faceY }}
        >
          <span
            style={{
              width: 13,
              height: 8,
              borderRadius: 9999,
              backgroundColor: PALETTE.blush,
              opacity: 0.5,
            }}
          />
          <span
            style={{
              width: 13,
              height: 8,
              borderRadius: 9999,
              backgroundColor: PALETTE.blush,
              opacity: 0.5,
            }}
          />
        </div>
      </div>
    </div>
  );
}
