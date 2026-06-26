/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the Inline citation component family ported to the Caracal design system.
*/
import {
  Children,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useNavigate } from "@tanstack/react-router";

import { cx } from "@/lib/cx";

// A citation destination inside the Console: the exact page and item an Operator answer
// refers to, so a reader can open it or preview it without leaving the conversation.
export interface CitationSource {
  // Stable key (the plan step id) so repeated destinations stay distinct in the carousel.
  key: string;
  // Human label for the item, e.g. the resource name, falling back to the capability title.
  title: string;
  // One-line preview describing what the step did or reads.
  description: string;
  // The Console domain the item lives in, shown as a small tag, e.g. "Resource".
  domainLabel: string;
  // The Console route that opens the item's page.
  to: string;
  // Search params that focus the destination page on the exact item.
  search: Record<string, string>;
}

const QuoteGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7 7h4v4c0 2.2-1.3 3.7-3.5 4.4l-.6-1.3C8.1 13.6 9 12.8 9 11.5H7V7Zm6 0h4v4c0 2.2-1.3 3.7-3.5 4.4l-.6-1.3c1.2-.5 2.1-1.3 2.1-2.6h-2V7Z" />
  </svg>
);

const ChevronGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="m9 6 6 6-6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const OpenGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M14 5h5v5M19 5l-8 8M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface CardSchema {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
  onEnter: () => void;
  onLeave: () => void;
}

const CardContext = createContext<CardSchema | null>(null);

const useCard = () => {
  const card = useContext(CardContext);
  if (!card) {
    throw new Error("Inline citation card parts must be used within InlineCitationCard");
  }
  return card;
};

export function InlineCitation({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("group inline", className)}>{children}</span>;
}

export function InlineCitationText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("rounded-sm transition-colors group-hover:bg-accent/40", className)}>
      {children}
    </span>
  );
}

export function InlineCitationCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const timer = useRef<number | null>(null);

  const onEnter = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setOpen(true);
  };

  const onLeave = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <CardContext.Provider value={{ open, setOpen, triggerRef, onEnter, onLeave }}>
      <span
        className={cx("relative ml-0.5 inline-flex align-baseline", className)}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
      </span>
    </CardContext.Provider>
  );
}

export function InlineCitationCardTrigger({
  sources,
  className,
}: {
  sources: string[];
  className?: string;
}) {
  const { open, setOpen, triggerRef, onEnter, onLeave } = useCard();
  const label = sources.length === 1 ? sources[0] : `${sources.length} sources`;
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      onFocus={onEnter}
      onBlur={onLeave}
      className={cx(
        "inline-flex max-w-[10rem] items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground transition-colors hover:border-accent-purple/50 hover:text-foreground",
        open && "border-accent-purple/60 text-foreground",
        className,
      )}
    >
      <QuoteGlyph className="h-2.5 w-2.5 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function InlineCitationCardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open, triggerRef, onEnter, onLeave } = useCard();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const width = 320;
    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      setPos({ top: rect.bottom + 6, left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, triggerRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      role="dialog"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: 320 }}
      className={cx(
        "z-[60] overflow-hidden rounded-md border border-border bg-card text-foreground shadow-lg",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

interface CarouselSchema {
  index: number;
  count: number;
  setCount: (count: number) => void;
  next: () => void;
  prev: () => void;
}

const CarouselContext = createContext<CarouselSchema | null>(null);

const useCarousel = () => {
  const carousel = useContext(CarouselContext);
  if (!carousel) {
    throw new Error("Inline citation carousel parts must be used within InlineCitationCarousel");
  }
  return carousel;
};

export function InlineCitationCarousel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const next = () => setIndex((value) => (count === 0 ? 0 : (value + 1) % count));
  const prev = () => setIndex((value) => (count === 0 ? 0 : (value - 1 + count) % count));
  return (
    <CarouselContext.Provider value={{ index, count, setCount, next, prev }}>
      <div className={cx("flex flex-col", className)}>{children}</div>
    </CarouselContext.Provider>
  );
}

export function InlineCitationCarouselHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function InlineCitationCarouselIndex({ className }: { className?: string }) {
  const { index, count } = useCarousel();
  return (
    <span className={cx("ml-auto text-[11px] tabular-nums text-muted-foreground", className)}>
      {count === 0 ? 0 : index + 1}/{count}
    </span>
  );
}

export function InlineCitationCarouselPrev({ className }: { className?: string }) {
  const { prev } = useCarousel();
  return (
    <button
      type="button"
      aria-label="Previous source"
      onClick={prev}
      className={cx(
        "grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <ChevronGlyph className="h-3 w-3 rotate-180" />
    </button>
  );
}

export function InlineCitationCarouselNext({ className }: { className?: string }) {
  const { next } = useCarousel();
  return (
    <button
      type="button"
      aria-label="Next source"
      onClick={next}
      className={cx(
        "grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <ChevronGlyph className="h-3 w-3" />
    </button>
  );
}

export function InlineCitationCarouselContent({ children }: { children: ReactNode }) {
  const { index, setCount } = useCarousel();
  const items = Children.toArray(children);

  useEffect(() => {
    setCount(items.length);
  }, [items.length, setCount]);

  return (
    <div className="overflow-hidden">
      <div
        className="flex transition-transform duration-200"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {children}
      </div>
    </div>
  );
}

export function InlineCitationCarouselItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("w-full flex-shrink-0 px-3 py-2.5", className)}>{children}</div>;
}

export function InlineCitationSource({
  source,
  className,
}: {
  source: CitationSource;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <span className="inline-flex w-fit items-center rounded border border-border bg-muted px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {source.domainLabel}
      </span>
      <button
        type="button"
        onClick={() => navigate({ to: source.to, search: source.search })}
        className="text-left text-sm font-medium text-foreground underline-offset-2 transition-colors hover:text-accent-purple hover:underline"
      >
        {source.title}
      </button>
      {source.description ? (
        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {source.description}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => navigate({ to: source.to, search: source.search })}
        className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-accent-purple/90 transition-colors hover:text-accent-purple"
      >
        Open in Console <OpenGlyph className="h-3 w-3" />
      </button>
    </div>
  );
}
