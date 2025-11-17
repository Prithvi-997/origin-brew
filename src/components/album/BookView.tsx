"use client";

import type { AlbumPage } from "@/lib/types";
import FrameEditor from "./FrameEditor";
import PageDropZone from "./PageDropZone";
import React from "react";

interface BookViewProps {
  pages: AlbumPage[];
  isEditMode?: boolean;
  pageStartIndex?: number;
  isDraggingAny?: boolean;
  dragSourcePageIndex?: number;
}

const BookView = ({
  pages,
  isEditMode = false,
  pageStartIndex = 0,
  isDraggingAny = false,
  dragSourcePageIndex = -1,
}: BookViewProps) => {
  const leftPage = pages[0];
  const rightPage = pages[1];
  const pageRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      className={`flex justify-center items-stretch gap-4 w-full ${
        isEditMode ? "aspect-[16/8.7]" : "aspect-[16/8.7]"
      }`}
    >
      {/* Left Page */}
      <div
        ref={pageRef}
        className="flex flex-col flex-1 max-w-[50vw] h-full rounded-l-lg border bg-white shadow-2xl overflow-hidden relative group"
      >
        {leftPage && (
          <>
            <div className="absolute inset-0 bg-white" style={{ zIndex: 0 }} />
            <div
              className={`flex-1 ${
                isEditMode ? "[&_*]:pointer-events-none" : ""
              }`}
              dangerouslySetInnerHTML={{ __html: leftPage.svgContent }}
              style={{
                width: "100%",
                height: "100%",
                pointerEvents: isEditMode ? "none" : "auto",
                position: "relative",
                zIndex: 1,
              }}
            />
            {isEditMode &&
              leftPage.frameCoordinates &&
              leftPage.frameCoordinates.map((frame, frameIndex) => (
                <FrameEditor
                  key={`frame-${pageStartIndex}-${frameIndex}`}
                  frameId={`frame-${pageStartIndex}-${frameIndex}`}
                  pageIndex={pageStartIndex}
                  frameIndex={frameIndex}
                  photoUrl={leftPage.photoIds?.[frameIndex]}
                  isEditMode={isEditMode}
                  style={{
                    position: "absolute",
                    left: `${(frame.x / 480) * 100}%`,
                    top: `${(frame.y / 540) * 100}%`,
                    width: `${(frame.width / 480) * 100}%`,
                    height: `${(frame.height / 540) * 100}%`,
                  }}
                  isDraggingAny={isDraggingAny}
                />
              ))}
            <PageDropZone pageIndex={pageStartIndex} isEditMode={isEditMode} />
          </>
        )}
      </div>

      {/* Book Spine/Center */}
      <div className="w-4 h-full bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 shadow-inner" />

      {/* Right Page */}
      <div className="flex flex-col flex-1 max-w-[50vw] h-full rounded-r-lg border bg-white shadow-2xl overflow-hidden relative group">
        {rightPage && (
          <>
            <div className="absolute inset-0 bg-white" style={{ zIndex: 0 }} />
            <div
              className={`flex-1 ${
                isEditMode ? "[&_*]:pointer-events-none" : ""
              }`}
              dangerouslySetInnerHTML={{ __html: rightPage.svgContent }}
              style={{
                width: "100%",
                height: "100%",
                pointerEvents: isEditMode ? "none" : "auto",
                position: "relative",
                zIndex: 1,
              }}
            />
            {isEditMode &&
              rightPage.frameCoordinates &&
              rightPage.frameCoordinates.map((frame, frameIndex) => (
                <FrameEditor
                  key={`frame-${pageStartIndex + 1}-${frameIndex}`}
                  frameId={`frame-${pageStartIndex + 1}-${frameIndex}`}
                  pageIndex={pageStartIndex + 1}
                  frameIndex={frameIndex}
                  photoUrl={rightPage.photoIds?.[frameIndex]}
                  isEditMode={isEditMode}
                  style={{
                    position: "absolute",
                    left: `${(frame.x / 480) * 100}%`,
                    top: `${(frame.y / 540) * 100}%`,
                    width: `${(frame.width / 480) * 100}%`,
                    height: `${(frame.height / 540) * 100}%`,
                  }}
                  isDraggingAny={isDraggingAny}
                />
              ))}
            <PageDropZone
              pageIndex={pageStartIndex + 1}
              isEditMode={isEditMode}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default BookView;
