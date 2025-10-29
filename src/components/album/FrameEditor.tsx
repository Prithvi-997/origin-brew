import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Trash2, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FrameEditorProps {
  frameId: string;
  pageIndex: number;
  frameIndex: number;
  photoUrl?: string;
  isEditMode: boolean;
  onRemovePhoto?: () => void;
}

export default function FrameEditor({
  frameId,
  pageIndex,
  frameIndex,
  photoUrl,
  isEditMode,
  onRemovePhoto,
}: FrameEditorProps) {
  const dragId = `photo-${pageIndex}-${frameIndex}`;
  const dropId = `frame-${pageIndex}-${frameIndex}`;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: dragId,
    data: {
      pageIndex,
      frameIndex,
      photoUrl,
    },
    disabled: !isEditMode || !photoUrl,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropId,
    data: {
      pageIndex,
      frameIndex,
    },
    disabled: !isEditMode,
  });

  if (!isEditMode) return null;

  return (
    <div
      ref={setDropRef}
      className={cn(
        "absolute inset-0 group",
        isOver && "ring-2 ring-primary ring-inset",
        isDragging && "opacity-50"
      )}
    >
      {photoUrl && (
        <div
          ref={setDragRef}
          {...attributes}
          {...listeners}
          className="absolute inset-0 cursor-move"
        >
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onRemovePhoto?.();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center">
              <Move className="h-4 w-4" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
