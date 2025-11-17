import type { AlbumPage } from "@/lib/types";
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
    <div className="flex justify-center w-full aspect-[8/9] mb-8">
      <div className="bg-white rounded-lg shadow-2xl overflow-hidden relative group w-full h-full">
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
                left: `${(frame.x / 480) * 100}%`,
                top: `${(frame.y / 540) * 100}%`,
                width: `${(frame.width / 480) * 100}%`,
                height: `${(frame.height / 540) * 100}%`,
              }}
            />
          ))}
        <PageDropZone pageIndex={pageStartIndex} isEditMode={isEditMode} />
      </div>
    </div>
  );
};

export default SinglePageView;
