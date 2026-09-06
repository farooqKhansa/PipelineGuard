import React from 'react';

/**
 * Icon set, inline.
 *
 * No icon library: a security tool ships a small, consistent set, and 24 hand
 * -picked 16px glyphs at 1.5px stroke cost less than a dependency and stay
 * visually uniform. All icons inherit currentColor.
 */

type P = { className?: string; size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const Icon = {
  Shield: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></svg>
  ),
  ShieldCheck: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
  ),
  Activity: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
  ),
  Branch: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="9" r="2" /><path d="M6 7v10M18 11c0 4-6 2-6 6" /></svg>
  ),
  Repo: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M5 4h12a2 2 0 012 2v14H7a2 2 0 01-2-2V4z" /><path d="M5 16h14" /><path d="M9 4v8l2-1.5L13 12V4" /></svg>
  ),
  Pipeline: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><rect x="3" y="4" width="6" height="5" rx="1" /><rect x="15" y="15" width="6" height="5" rx="1" /><path d="M9 6.5h4a2 2 0 012 2v6a2 2 0 002 2h.5" /></svg>
  ),
  Brain: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 003 3V4z" /><path d="M15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-3 3V4z" /><path d="M12 4v16" /></svg>
  ),
  Alert: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M12 4l9 16H3l9-16z" /><path d="M12 10v4M12 17h.01" /></svg>
  ),
  Bell: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M18 15V10a6 6 0 10-12 0v5l-2 3h16l-2-3z" /><path d="M10 21h4" /></svg>
  ),
  Check: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M4 12l5 5L20 6" /></svg>
  ),
  X: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  Pause: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M9 5v14M15 5v14" /></svg>
  ),
  Hand: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M9 11V5.5a1.5 1.5 0 013 0V11m0-1.5a1.5 1.5 0 013 0V12m0-1a1.5 1.5 0 013 0v4a5 5 0 01-5 5h-2a5 5 0 01-5-5v-4.5a1.5 1.5 0 013 0" /></svg>
  ),
  Wrench: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M15 7a4 4 0 01-5.3 3.8L5 15.5 8.5 19l4.7-4.7A4 4 0 0117 9.5" /><circle cx="16.5" cy="6.5" r="2.5" /></svg>
  ),
  Graph: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h10M6 8l5 8M18 8l-5 8" /></svg>
  ),
  History: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></svg>
  ),
  Chart: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></svg>
  ),
  Inbox: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M4 13l2-8h12l2 8v6H4v-6z" /><path d="M4 13h4l1 2h6l1-2h4" /></svg>
  ),
  Users: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0" /><path d="M16 5.5a3 3 0 010 5.8M17 20a6 6 0 00-1.5-4" /></svg>
  ),
  Plug: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M9 3v6M15 3v6" /><path d="M6 9h12v3a6 6 0 01-12 0V9z" /><path d="M12 18v3" /></svg>
  ),
  Settings: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M21 12h-2M5 12H3M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4L17 17M7 7L5.6 5.6" /></svg>
  ),
  Play: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M7 5l12 7-12 7V5z" /></svg>
  ),
  Replay: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M21 12a9 9 0 11-2.6-6.4L21 8" /><path d="M21 3v5h-5" /><path d="M10 9l5 3-5 3V9z" /></svg>
  ),
  File: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5" /></svg>
  ),
  Lock: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
  ),
  Key: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="8" cy="14" r="4" /><path d="M11 11l8-8M17 5l2 2M15 7l2 2" /></svg>
  ),
  Clock: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  Search: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
  ),
  ChevronRight: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M9 5l7 7-7 7" /></svg>
  ),
  ChevronDown: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M5 9l7 7 7-7" /></svg>
  ),
  ArrowRight: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
  ),
  ArrowDown: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M12 4v15M6 13l6 6 6-6" /></svg>
  ),
  Sun: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M22 12h-2M4 12H2M18.4 5.6L17 7M7 17l-1.4 1.4M18.4 18.4L17 17M7 7L5.6 5.6" /></svg>
  ),
  Moon: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" /></svg>
  ),
  Globe: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" /></svg>
  ),
  Dot: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" /></svg>
  ),
  Layers: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>
  ),
  Policy: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M6 3h9l4 4v14H6V3z" /><path d="M9 9h7M9 13h7M9 17h4" /></svg>
  ),
  Book: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M5 4h9a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" /><path d="M5 17a3 3 0 013-3h9" /></svg>
  ),
  Spark: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>
  ),
  Radar: ({ className, size = 16 }: P) => (
    <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><path d="M12 12l6-4" /></svg>
  ),
};

export type IconName = keyof typeof Icon;
