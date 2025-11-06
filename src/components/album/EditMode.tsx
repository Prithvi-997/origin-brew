import { useState } from 'react';
import { AlbumPage, Photo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Save, X, Undo2, Redo2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import PageThumbnailStrip from './PageThumbnailStrip';

import { useEditHistory } from '@/hooks/useEditHistory';
import {
  swapPhotos,
  reorderPages,
  movePhotoWithLayoutAdjustment,
} from '@/lib/editOperations';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface EditModeProps {
  pages: AlbumPage[]
  photos: Photo[]
  currentPage: number
  onPagesChange: (pages: AlbumPage[]) => void
  onCurrentPageChange: (page: number) => void
  onSave: (pages: AlbumPage[]) => void
  onCancel: () => void
  viewMode: "single" | "book"
}

export default function EditMode({
  pages,
  photos,
  currentPage,
  onPagesChange,
  onCurrentPageChange,
  onSave,
  onCancel,
  viewMode,
}: EditModeProps) {
  const [workingPages, setWorkingPages] = useState(pages)
  const [draggedItem, setDraggedItem] = useState<any>(null)

  const { canUndo, canRedo, addEntry, undo, redo } = useEditHistory()

  const handleSave = () => {
    onPagesChange(workingPages)
    onSave(workingPages)
    toast.success("Changes saved successfully")
  }

  const handleUndo = () => {
    const entry = undo()
    if (entry) {
      toast.info("Undo: " + entry.operation)
    }
  }

  const handleRedo = () => {
    const entry = redo()
    if (entry) {
      toast.info("Redo: " + entry.operation)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedItem(event.active.data.current)
    console.log("[v0] Drag started:", event.active.data.current)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setDraggedItem(null)

    if (!over) return

    const sourceType = active.data.current?.type
    const overType = over.data.current?.type

    // Handle page reordering
    if (sourceType === "page" && overType === "page") {
      const oldIndex = workingPages.findIndex((p) => `page-${p.id}` === active.id)
      const newIndex = workingPages.findIndex((p) => `page-${p.id}` === over.id)

      if (oldIndex !== newIndex) {
        const newPages = reorderPages(workingPages, oldIndex, newIndex)
        setWorkingPages(newPages)
        onPagesChange(newPages)
        addEntry({
          operation: "reorder_pages",
          details: { from: oldIndex, to: newIndex },
        })
        toast.success("Pages reordered")
      }
      return
    }

    // Handle photo swapping/moving
    const sourceData = active.data.current as { pageIndex: number; frameIndex: number } | undefined;
    const targetData = over.data.current as { pageIndex: number; frameIndex?: number } | undefined;

    if (sourceData && targetData) {
      const targetPageIndex = targetData.pageIndex;
      const targetFrameIndex = typeof targetData.frameIndex === 'number' ? targetData.frameIndex : 0;

      // Check if it's a cross-page drag
      if (sourceData.pageIndex !== targetPageIndex) {
        // Move photo with automatic layout adjustment
        const newPages = movePhotoWithLayoutAdjustment(
          workingPages,
          sourceData.pageIndex,
          sourceData.frameIndex,
          targetPageIndex,
          targetFrameIndex,
          photos
        );
        setWorkingPages(newPages);
        onPagesChange(newPages);
        addEntry({
          operation: 'move_photo_cross_page',
          details: { source: sourceData, target: { pageIndex: targetPageIndex, frameIndex: targetFrameIndex } },
        });
        toast.success('Photo moved and layouts adjusted');
      } else if (typeof targetData.frameIndex === 'number') {
        // Same page swap
        const newPages = swapPhotos(
          workingPages,
          sourceData.pageIndex,
          sourceData.frameIndex,
          targetPageIndex,
          targetFrameIndex,
          photos
        );
        setWorkingPages(newPages);
        onPagesChange(newPages);
        addEntry({
          operation: 'swap_photos',
          details: { source: sourceData, target: { pageIndex: targetPageIndex, frameIndex: targetFrameIndex } },
        });
        toast.success('Photos swapped');
      }
    }
  }

  const totalPages = workingPages.length
  const isDraggingPhoto = !!(draggedItem && "photoUrl" in draggedItem)

  const dragOverlay = draggedItem?.photoUrl ? (
    <div className="w-32 h-32 rounded-lg overflow-hidden shadow-2xl border-2 border-primary opacity-80">
      <img src={draggedItem.photoUrl || "/placeholder.svg"} alt="Dragging" className="w-full h-full object-cover" />
    </div>
  ) : null

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd} overlay={dragOverlay}>
      {/* Edit Mode Toolbar */}
      <div className="fixed top-16 left-0 right-0 bg-primary/10 backdrop-blur border-b z-50">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">Edit Mode</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <Button variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4 mr-2" />
              Redo
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Page Thumbnails */}
      <SortableContext
        items={workingPages.map((p) => `page-${p.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <PageThumbnailStrip
          pages={workingPages}
          currentPage={currentPage}
          onPageSelect={onCurrentPageChange}
          isEditMode={true}
          isDraggingPhoto={isDraggingPhoto}
        />
      </SortableContext>

      <ScrollArea className="h-[calc(100vh-220px)] scroll-area-viewport">
        <div className="space-y-8 pb-8">
          {Array.from({ length: Math.ceil(totalPages / 2) }, (_, i) => {
            const leftPage = workingPages[i * 2]
            const rightPage = workingPages[i * 2 + 1]
            return (
              <div key={i} className="scroll-snap-start">
                <BookView
                  pages={[leftPage, rightPage].filter(Boolean)}
                  isEditMode={true}
                  pageStartIndex={i * 2}
                  isDraggingAny={!!draggedItem}
                  dragSourcePageIndex={draggedItem?.pageIndex ?? -1}
                />
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </DragDropProvider>
  )
}
