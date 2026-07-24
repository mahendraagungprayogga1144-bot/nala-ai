"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>[]{}";

/** Sci-fi scramble reveal — skipped when `instant` (mobile light home). */
export function DecodeText({
  text,
  delay = 0,
  className,
  style,
  instant = false,
}: {
  text: string;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  instant?: boolean;
}) {
  const [display, setDisplay] = useState(instant ? text : text);
  const [started, setStarted] = useState(instant);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (instant) {
      setDisplay(text);
      return;
    }
    const startT = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startT);
  }, [delay, instant, text]);

  useEffect(() => {
    if (instant || !started) return;
    let frame = 0;
    const totalFrames = Math.max(20, text.length * 2.2);
    const iv = setInterval(() => {
      frame++;
      const revealed = Math.floor((frame / totalFrames) * text.length);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") {
          out += " ";
          continue;
        }
        if (i < revealed) out += text[i];
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setDisplay(out);
      if (frame >= totalFrames) {
        setDisplay(text);
        clearInterval(iv);
      }
    }, 35);
    return () => clearInterval(iv);
  }, [started, text, instant]);

  return (
    <span ref={ref} className={className} style={style}>
      {display}
    </span>
  );
}
