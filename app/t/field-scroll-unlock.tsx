"use client";

import { useEffect } from "react";

/**
 * Chrome Android sering mengunci scroll kalau root body pakai flex + overscroll-none.
 * Untuk link lapangan /t/... kita pakai scroll dokumen (paling andal di HP).
 */
export default function FieldScrollUnlock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prev = {
      htmlHeight: html.style.height,
      htmlOverflow: html.style.overflow,
      htmlOverflowY: html.style.overflowY,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
      bodyOverflow: body.style.overflow,
      bodyOverflowY: body.style.overflowY,
      bodyDisplay: body.style.display,
      bodyFlex: body.style.flexDirection,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyOverscrollY: body.style.overscrollBehaviorY,
      bodyTouchAction: body.style.touchAction,
    };

    html.style.height = "auto";
    html.style.overflow = "visible";
    html.style.overflowY = "auto";

    body.style.height = "auto";
    body.style.minHeight = "100dvh";
    body.style.overflow = "visible";
    body.style.overflowY = "auto";
    body.style.display = "block";
    body.style.flexDirection = "initial";
    body.style.overscrollBehavior = "auto";
    body.style.overscrollBehaviorY = "auto";
    body.style.touchAction = "pan-y pinch-zoom";

    return () => {
      html.style.height = prev.htmlHeight;
      html.style.overflow = prev.htmlOverflow;
      html.style.overflowY = prev.htmlOverflowY;
      body.style.height = prev.bodyHeight;
      body.style.minHeight = prev.bodyMinHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.overflowY = prev.bodyOverflowY;
      body.style.display = prev.bodyDisplay;
      body.style.flexDirection = prev.bodyFlex;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.overscrollBehaviorY = prev.bodyOverscrollY;
      body.style.touchAction = prev.bodyTouchAction;
    };
  }, []);

  return null;
}
