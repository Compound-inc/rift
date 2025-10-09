"use client";

import { ChevronDown } from "lucide-react";

interface VideoPlayerProps {
  currentTime: string;
  totalTime: string;
  currentSegment: string;
  segmentName: string;
  subtitle: string;
  progress: number;
}

export function VideoPlayer({
  currentTime,
  totalTime,
  currentSegment,
  segmentName,
  subtitle,
  progress,
}: VideoPlayerProps) {
  return (
    <details open className="group">
      <summary className="mb-4 flex cursor-pointer items-center justify-between text-base font-medium">
        <span>Clase 2021</span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>

      {/* Video Player */}
      <div className="relative mb-6 overflow-hidden rounded-lg bg-black">
        <div className="aspect-video">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shot.png"
            alt="Meeting"
            className="h-full w-full object-cover"
          />
          {/* Video Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Segment Badge */}
            <div className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
              {currentSegment} {segmentName}
            </div>

            {/* Subtitle */}
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded bg-black/80 px-4 py-2 text-sm text-white backdrop-blur">
              {subtitle}
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-white/90">
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <span className="text-xs text-white">
                    {currentTime} / {totalTime}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button className="text-xs text-white hover:text-white/80">
                    1x
                  </button>
                  <button className="text-white hover:text-white/80">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                  <button className="text-white hover:text-white/80">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
