"use client";

import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Trash2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import type React from "react";

interface FrameEditorProps {
  frameId: string;
  pageIndex: number;
  frameIndex: number;
  photoUrl?: string;
  isEditMode: boolean;
  onRemovePhoto?: () => void;
  style?: React.CSSProperties;
  isDraggingAny?: boolean;
}

export default function FrameEditor({
  frameId,
  pageIndex,
  frameIndex,
  photoUrl,
  isEditMode,
  onRemovePhoto,
  style,
  isDraggingAny = false,
}: FrameEditorProps) {
  console.log("[v0] FrameEditor render:", {
    frameId,
    pageIndex,
    frameIndex,
    photoUrl: photoUrl ? "present" : "empty",
    isEditMode,
    style,
    isDraggingAny,
  });

  const dragId = `photo-${pageIndex}-${frameIndex}`;
  const dropId = `frame-${pageIndex}-${frameIndex}`;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: dragId,
    data: {
      pageIndex,
      frameIndex,
      photoUrl,
    },
    disabled: !isEditMode || !photoUrl,
  });

  console.log("[v0] FrameEditor drag state:", {
    dragId,
    isDragging,
    disabled: !isEditMode || !photoUrl,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: dropId,
    data: {
      pageIndex,
      frameIndex,
      photoUrl,
    },
    disabled: !isEditMode,
  });

  console.log("[v0] FrameEditor drop state:", {
    dropId,
    isOver,
    disabled: !isEditMode,
  });

  const setRefs = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  if (!isEditMode) return null;

  const showAsDropTarget = isDraggingAny && !isDragging;

  return (
    <div
      ref={setRefs}
      style={{
        ...style,
        zIndex: 10,
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
      data-testid={`frame-editor-${pageIndex}-${frameIndex}`}
      className={cn(
        "group transition-all duration-200",
        photoUrl ? "cursor-move" : "cursor-default",
        isOver && "ring-2 ring-primary ring-inset",
        isDragging && "opacity-30",
        isDraggingAny && !isDragging && "opacity-40",
        isDraggingAny && "ring-1 ring-primary/30 ring-inset"
      )}
    >
      {photoUrl && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 pointer-events-none">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              onRemovePhoto?.();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center pointer-events-none">
            <Move className="h-4 w-4" />
          </div>
        </div>
      )}

      {!photoUrl && (isOver || showAsDropTarget) && (
        <div
          className={cn(
            "absolute inset-0 border-2 border-dashed flex items-center justify-center transition-all",
            isOver
              ? "bg-primary/20 border-primary"
              : "bg-primary/5 border-primary/30"
          )}
        >
          <span
            className={cn(
              "text-xs font-medium",
              isOver ? "text-primary" : "text-primary/50"
            )}
          >
            {isOver ? "Drop here" : "Drop zone"}
          </span>
        </div>
      )}
    </div>
  );
}
