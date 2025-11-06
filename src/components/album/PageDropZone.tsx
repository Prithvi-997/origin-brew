import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface PageDropZoneProps {
  pageIndex: number;
  isEditMode?: boolean;
}

export default function PageDropZone({
  pageIndex,
  isEditMode = false,
}: PageDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `page-${pageIndex}`,
    data: { pageIndex },
    disabled: !isEditMode,
  });

  if (!isEditMode) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "pointer-events-none absolute inset-0 rounded-md",
        isOver && "ring-2 ring-primary/50 ring-inset"
      )}
    />
  );
}
