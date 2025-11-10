import { AlbumPage } from "@/lib/types";
import FrameEditor from "@/components/album/FrameEditor";
import PageDropZone from "@/components/album/PageDropZone";
interface SinglePageViewProps {
  pages: AlbumPage[];
  isEditMode?: boolean;
  pageStartIndex?: number;
}

const SinglePageView = ({
  pages,
  isEditMode = false,
  pageStartIndex = 0,
}: SinglePageViewProps) => {
  if (!pages || pages.length === 0) return null;

  const page = pages[0];

  return (
    <div className="flex justify-center">
      <div className="bg-white rounded-lg shadow-2xl overflow-hidden relative group w-full max-w-xl aspect-[5/6] mx-auto">
        <div
          dangerouslySetInnerHTML={{ __html: page.svgContent }}
          style={{ width: "100%", height: "100%" }}
        />
        {isEditMode &&
          page.frameCoordinates &&
          page.frameCoordinates.map((frame, frameIndex) => (
            <FrameEditor
              key={`frame-${pageStartIndex}-${frameIndex}`}
              frameId={`frame-${pageStartIndex}-${frameIndex}`}
              pageIndex={pageStartIndex}
              frameIndex={frameIndex}
              photoUrl={page.photoIds?.[frameIndex]}
              isEditMode={isEditMode}
              style={{
                position: "absolute",
                left: `${frame.x}px`,
                top: `${frame.y}px`,
                width: `${frame.width}px`,
                height: `${frame.height}px`,
              }}
            />
          ))}
        <PageDropZone pageIndex={pageStartIndex} isEditMode={isEditMode} />
      </div>
    </div>
  );
};

export default SinglePageView;
