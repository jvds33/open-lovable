"use client";

export default function HomeHeroBackground() {
  return (
    <div className="overlay pointer-events-none lg-max:hidden">
      {/* Simple Vercel-style grid background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-50" />

      {/* Minimal center vertical line */}
      <div className="absolute left-1/2 top-0 h-full w-px bg-gray-200 -translate-x-1/2" />
    </div>
  );
}
