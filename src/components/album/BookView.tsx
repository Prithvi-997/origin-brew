import { AlbumPage } from "@/lib/types";
import FrameEditor from "./FrameEditor";
import PageDropZone from "./PageDropZone";
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

  console.log("[v0] BookView render:", {
    pageStartIndex,
    isEditMode,
    isDraggingAny,
    dragSourcePageIndex,
    leftPageFrameCount: leftPage?.frameCoordinates?.length || 0,
    rightPageFrameCount: rightPage?.frameCoordinates?.length || 0,
    leftPageLayout: leftPage?.layoutName,
    rightPageLayout: rightPage?.layoutName,
  });

  if (leftPage?.frameCoordinates) {
    console.log("[v0] Left page frame coordinates:", leftPage.frameCoordinates);
  }
  if (rightPage?.frameCoordinates) {
    console.log(
      "[v0] Right page frame coordinates:",
      rightPage.frameCoordinates
    );
  }

  return (
    <div className="flex justify-center items-start gap-1">
      {/* Left Page */}
      <div 
        className="w-[500px] h-[600px] rounded-l-lg border bg-white shadow-2xl overflow-hidden relative group"
      >
        {leftPage && (
          <>
            <div className="absolute inset-0 bg-white" style={{ zIndex: 0 }} />
            <div
              dangerouslySetInnerHTML={{ __html: leftPage.svgContent }}
              style={{
                width: "100%",
                height: "100%",
                pointerEvents: isEditMode ? "none" : "auto",
                position: "relative",
                zIndex: 1,
              }}
              className={isEditMode ? "[&_*]:pointer-events-none" : ""}
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
                    left: `${frame.x}%`,
                    top: `${frame.y}%`,
                    width: `${frame.width}%`,
                    height: `${frame.height}%`,
                  }}
                  isDraggingAny={isDraggingAny}
                />
              ))}
            <PageDropZone
              pageIndex={pageStartIndex}
              isEditMode={isEditMode}
            />
          </>
        )}
      </div>

      {/* Book Spine/Center */}
      <div className="w-4 h-[600px] bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 shadow-inner" />

      {/* Right Page */}
      <div 
        className="w-[500px] h-[600px] rounded-r-lg border bg-white shadow-2xl overflow-hidden relative group"
      >
        {rightPage && (
          <>
            <div className="absolute inset-0 bg-white" style={{ zIndex: 0 }} />
            <div
              dangerouslySetInnerHTML={{ __html: rightPage.svgContent }}
              style={{
                width: "100%",
                height: "100%",
                pointerEvents: isEditMode ? "none" : "auto",
                position: "relative",
                zIndex: 1,
              }}
              className={isEditMode ? "[&_*]:pointer-events-none" : ""}
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
                    left: `${frame.x}%`,
                    top: `${frame.y}%`,
                    width: `${frame.width}%`,
                    height: `${frame.height}%`,
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
