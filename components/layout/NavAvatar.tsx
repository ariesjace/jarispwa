"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  NavAvatar — gradient initial-letter avatar
//  Usage: <NavAvatar initials="AR" size={36} />
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { TOKEN } from "./tokens";

export interface NavAvatarProps {
  initials: string;
  size?:    number;
}

export function NavAvatar({ initials, size = 36 }: NavAvatarProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width:          size,
        height:         size,
        borderRadius:   10,
        background:     `linear-gradient(135deg, ${TOKEN.primary}, ${TOKEN.accent})`,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        color:          "#fff",
        fontSize:       size * 0.34,
        fontWeight:     700,
        flexShrink:     0,
        userSelect:     "none",
        letterSpacing:  "0.02em",
      }}
    >
      {initials}
    </div>
  );
}
