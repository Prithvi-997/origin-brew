import { AlbumPage } from "@/lib/types";
import FrameEditor from "./FrameEditor";
import PageDropZone from "./PageDropZone";
interface SinglePageViewProps {
  pages: AlbumPage[];
  isEditMode?: boolean;
  pageStartIndex?: number;
}

const SinglePageView = ({ pages, isEditMode = false, pageStartIndex = 0 }: SinglePageViewProps) => {
  if (!pages || pages.length === 0) return null;

  const page = pages[0];

  return (
    <div className="flex justify-center">
      <div 
        className="bg-white rounded-lg shadow-2xl overflow-hidden relative group"
        style={{ width: '500px', height: '600px' }}
      >
        <div 
          dangerouslySetInnerHTML={{ __html: page.svgContent }}
          style={{ width: '100%', height: '100%' }}
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
                left: `${frame.x}%`,
                top: `${frame.y}%`,
                width: `${frame.width}%`,
                height: `${frame.height}%`,
              }}
            />
          ))}
        <PageDropZone
          pageIndex={pageStartIndex}
          isEditMode={isEditMode}
        />
      </div>
    </div>
  );
};

export default SinglePageView;
