"use client";

import { useEffect } from "react";

// A cart can stay open behind the options dialog. Releasing one overlay must not
// unlock the page while the other still owns it.
let locks = 0;
let restore = () => {};
export function useBodyScrollLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (locks++ === 0) {
      const body = document.body;
      const root = document.documentElement;
      const overflow = body.style.overflow;
      const rootOverflow = root.style.overflow;
      const paddingRight = body.style.paddingRight;
      const gutter = window.innerWidth - root.clientWidth;
      if (gutter > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + gutter}px`;
      body.style.overflow = "hidden";
      root.style.overflow = "hidden";
      restore = () => { body.style.overflow = overflow; root.style.overflow = rootOverflow; body.style.paddingRight = paddingRight; };
    }
    return () => { if (--locks === 0) restore(); };
  }, [enabled]);
}
