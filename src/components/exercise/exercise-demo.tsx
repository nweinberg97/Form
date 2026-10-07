"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Captions, CaptionsOff, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";
import { RIG, renderSvgInner, timeline, type Demo } from "@/lib/rig";
import { youTubeEmbedUrl } from "@/lib/youtube";
import type { ExerciseVideo } from "@/server/services/plan";

type Props = {
  name: string;
  demo: Demo | null;
  /** Real video (clinic's own or FORM's curated YouTube demonstration). */
  video?: ExerciseVideo | null;
  /** Fallback content if no media can be shown. */
  instructions?: string[];
  tone?: "paper" | "dark";
  size?: "md" | "lg";
  autoPlay?: boolean;
  className?: string;
  /** Hide controls (thumbnails). */
  bare?: boolean;
};

const SPEEDS = [0.5, 1] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

/**
 * The exercise demonstration. Plays a real video when the clinic has one,
 * otherwise FORM's generated movement demonstration. Never a dead block:
 * if media fails, the cues and instructions are shown instead.
 */
export function ExerciseDemo(props: Props) {
  const [videoFailed, setVideoFailed] = useState(false);
  const online = useOnline();
  const hasVideo = Boolean(props.video) && !videoFailed && online;
  const [mode, setMode] = useState<"video" | "guide">("video");
  const showVideo = hasVideo && (mode === "video" || !props.demo);

  let media: React.ReactNode;
  if (showVideo && props.video?.provider === "youtube") {
    media = <YouTubeDemo name={props.name} id={props.video.id} className={props.className} />;
  } else if (showVideo && props.video?.provider === "file") {
    media = (
      <VideoDemo
        {...props}
        videoUrl={props.video.url}
        posterUrl={props.video.poster}
        captionsUrl={props.video.captionsUrl}
        onFail={() => setVideoFailed(true)}
      />
    );
  } else if (props.demo) {
    media = <AnimatedDemo {...props} demo={props.demo} />;
  } else {
    media = <MediaFallback name={props.name} instructions={props.instructions} className={props.className} />;
  }

  if (props.bare || !(hasVideo && props.demo)) {
    return (
      <div>
        {media}
        {props.video && !hasVideo && !props.bare ? (
          <p className="mt-2 text-xs text-muted">
            {online ? "The video couldn't load, so here's the movement guide." : "You're offline — showing the movement guide."}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {media}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Demonstration type" className="inline-flex rounded-md bg-sunken p-0.5">
          {(["video", "guide"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "h-8 rounded-[7px] px-3 text-[13px] font-medium transition-colors",
                mode === value ? "bg-white text-ink shadow-[0_1px_2px_rgb(17_17_17/0.08)]" : "text-muted hover:text-ink",
              )}
            >
              {value === "video" ? "Video" : "Movement guide"}
            </button>
          ))}
        </div>
        {mode === "video" && props.video?.source ? (
          <p className="truncate text-xs text-muted">
            {props.video.clinicChoice ? "Chosen by your clinic" : `Video: ${props.video.source}`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

/** Click-to-load YouTube embed: nothing is requested from YouTube until the viewer chooses to play. */
function YouTubeDemo({ name, id, className }: { name: string; id: string; className?: string }) {
  const [active, setActive] = useState(false);
  return (
    <figure className={cn("relative aspect-video overflow-hidden rounded-[14px] bg-ink", className)}>
      {active ? (
        <iframe
          src={`${youTubeEmbedUrl(id)}&autoplay=1`}
          title={`${name} — video demonstration`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label={`Play ${name} video`}
          className="group absolute inset-0 flex items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover opacity-80 transition-opacity group-hover:opacity-95"
          />
          <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-signal text-ink shadow-[var(--shadow-lift)] transition-transform duration-200 ease-[var(--ease-form)] group-hover:scale-105">
            <Play className="ml-1 size-7 fill-current" aria-hidden />
          </span>
        </button>
      )}
      <figcaption className="sr-only">{name} video demonstration</figcaption>
    </figure>
  );
}

function MediaFallback({ name, instructions, className }: { name: string; instructions?: string[]; className?: string }) {
  return (
    <div className={cn("flex aspect-[16/10] flex-col justify-end rounded-[14px] bg-sunken p-5", className)}>
      <p className="kicker text-muted">Demonstration unavailable</p>
      <p className="mt-1 text-base font-semibold">{name}</p>
      {instructions?.length ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] text-ink/80">
          {instructions.slice(0, 3).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function AnimatedDemo({
  name,
  demo,
  tone = "paper",
  size = "lg",
  autoPlay = true,
  className,
  bare,
}: Props & { demo: Demo }) {
  const reducedMotion = usePrefersReducedMotion();
  const tl = useMemo(() => timeline(demo), [demo]);
  const groupRef = useRef<SVGGElement>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [captions, setCaptions] = useState(true);
  const [cue, setCue] = useState<string | undefined>(demo.frames[0]?.cue);
  const clock = useRef(0);
  const last = useRef<number | null>(null);

  const colors =
    tone === "dark"
      ? { ink: "#F4F2ED", muted: "#4A4743", accent: "#FF4D2E", ground: "#2F2D2A" }
      : { ink: "#111111", muted: "#C9C4B9", accent: "#FF4D2E", ground: "#D9D5CC" };

  const draw = useCallback(
    (time: number) => {
      const { pose, cue: nextCue } = tl.at(time);
      if (groupRef.current) {
        groupRef.current.innerHTML = renderSvgInner(demo, pose, {
          ...colors,
          ghost: demo.frames[demo.frames.length > 1 ? 1 : 0].pose,
        });
      }
      setCue((current) => (current === nextCue ? current : nextCue));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tl, demo, tone],
  );

  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    draw(clock.current);
    if (!playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (last.current !== null) clock.current += ((now - last.current) / 1000) * speed;
      last.current = now;
      draw(clock.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing, speed, draw]);

  const restart = () => {
    clock.current = 0;
    last.current = null;
    draw(0);
    setPlaying(true);
  };

  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded-[14px]",
        tone === "dark" ? "bg-night-raised" : "bg-sunken",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${RIG.width} ${RIG.height}`}
        role="img"
        aria-label={`Animated demonstration of ${name}${cue ? `. ${cue}` : ""}`}
        className={cn("block w-full", size === "lg" ? "aspect-[16/10]" : "aspect-[16/10]")}
      >
        <g ref={groupRef} />
      </svg>

      {!bare ? (
        <>
          {captions && cue ? (
            <figcaption
              aria-live="polite"
              className={cn(
                "pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit max-w-[85%] rounded-md px-3 py-1.5 text-center text-sm font-medium",
                tone === "dark" ? "bg-ink/80 text-paper" : "bg-paper/90 text-ink",
              )}
            >
              {cue}
            </figcaption>
          ) : (
            <figcaption className="sr-only">{name} demonstration</figcaption>
          )}
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-1">
            <DemoButton
              label={playing ? "Pause demonstration" : "Play demonstration"}
              onClick={() => setPlaying((p) => !p)}
              tone={tone}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </DemoButton>
            <DemoButton label="Replay from the start" onClick={restart} tone={tone}>
              <RotateCcw className="size-4" />
            </DemoButton>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setSpeed((s) => (s === 1 ? 0.5 : 1))}
              aria-label={`Playback speed ${speed}×. Change speed`}
              className={cn(
                "h-9 rounded-md px-2.5 font-mono text-xs font-medium transition-colors",
                tone === "dark" ? "bg-ink/70 text-paper hover:bg-ink" : "bg-paper/85 text-ink hover:bg-paper",
              )}
            >
              {speed === 1 ? "1×" : "½×"}
            </button>
            <DemoButton
              label={captions ? "Hide cues" : "Show cues"}
              onClick={() => setCaptions((c) => !c)}
              tone={tone}
              pressed={captions}
            >
              {captions ? <Captions className="size-4" /> : <CaptionsOff className="size-4" />}
            </DemoButton>
          </div>
        </>
      ) : null}
    </figure>
  );
}

function DemoButton({
  label,
  onClick,
  children,
  tone,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  tone: "paper" | "dark";
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md transition-colors",
        tone === "dark" ? "bg-ink/70 text-paper hover:bg-ink" : "bg-paper/85 text-ink hover:bg-paper",
      )}
    >
      {children}
    </button>
  );
}

function VideoDemo({
  name,
  videoUrl,
  posterUrl,
  captionsUrl,
  onFail,
  className,
  autoPlay = true,
}: Props & { videoUrl: string; posterUrl: string | null; captionsUrl: string | null; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  return (
    <figure className={cn("relative overflow-hidden rounded-[14px] bg-ink", className)}>
      <video
        ref={ref}
        src={videoUrl}
        poster={posterUrl ?? undefined}
        className="block aspect-[16/10] w-full object-cover"
        autoPlay={autoPlay}
        muted={muted}
        loop
        playsInline
        controls
        preload="metadata"
        aria-label={`${name} demonstration video`}
        onLoadedData={() => setLoading(false)}
        onError={onFail}
      >
        {captionsUrl ? <track kind="captions" src={captionsUrl} srcLang="en" label="English" default /> : null}
      </video>
      {loading ? <div aria-hidden className="absolute inset-0 animate-pulse bg-night-raised" /> : null}
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-md bg-ink/70 text-paper"
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
    </figure>
  );
}

/** Static poster frame — for lists and thumbnails. Server-renderable. */
export function DemoThumb({ demo, className, label }: { demo: Demo | null; className?: string; label: string }) {
  if (!demo) {
    return <div aria-hidden className={cn("aspect-[16/10] rounded-[10px] bg-sunken", className)} />;
  }
  const last = demo.frames[Math.min(1, demo.frames.length - 1)].pose;
  return (
    <svg
      viewBox={`16 10 ${RIG.width - 32} ${RIG.height - 10}`}
      role="img"
      aria-label={label}
      className={cn("block aspect-[16/10] rounded-[10px] bg-sunken", className)}
      dangerouslySetInnerHTML={{ __html: renderSvgInner(demo, last, { ghost: demo.frames[0].pose }) }}
    />
  );
}
