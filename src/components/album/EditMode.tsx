import { useState } from 'react';
import { AlbumPage, Photo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Save, X, Undo2, Redo2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import PageThumbnailStrip from './PageThumbnailStrip';
import DragDropProvider from './DragDropProvider';
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
  pages: AlbumPage[];
  photos: Photo[];
  currentPage: number;
  onPagesChange: (pages: AlbumPage[]) => void;
  onCurrentPageChange: (page: number) => void;
  onSave: (pages: AlbumPage[]) => void;
  onCancel: () => void;
  viewMode: 'single' | 'book';
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
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
  onDragStart: parentOnDragStart,
  onDragEnd: parentOnDragEnd,
}: EditModeProps) {
  const [workingPages, setWorkingPages] = useState(pages);
  const [draggedItem, setDraggedItem] = useState<any>(null);

  const { canUndo, canRedo, addEntry, undo, redo } = useEditHistory();

  const handleSave = () => {
    onPagesChange(workingPages);
    onSave(workingPages);
    toast.success('Changes saved successfully');
  };

  const handleUndo = () => {
    const entry = undo();
    if (entry) {
      // Implement undo logic based on operation type
      toast.info('Undo: ' + entry.operation);
    }
  };

  const handleRedo = () => {
    const entry = redo();
    if (entry) {
      // Implement redo logic based on operation type
      toast.info('Redo: ' + entry.operation);
    }
  };


  const handleDragStart = (event: DragStartEvent) => {
    setDraggedItem(event.active.data.current);
    parentOnDragStart(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    parentOnDragEnd(event);

    if (!over) return;

    // Handle page reordering
    if (active.id.toString().startsWith('page-')) {
      const oldIndex = workingPages.findIndex(p => p.id === active.id);
      const newIndex = workingPages.findIndex(p => p.id === over.id);
      
      if (oldIndex !== newIndex) {
        const newPages = reorderPages(workingPages, oldIndex, newIndex);
        setWorkingPages(newPages);
        onPagesChange(newPages);
        addEntry({
          operation: 'reorder_pages',
          details: { from: oldIndex, to: newIndex },
        });
        toast.success('Pages reordered');
      }
      return;
    }

    // Handle photo swapping/moving
    const sourceData = active.data.current;
    const targetData = over.data.current;

    if (sourceData && targetData) {
      // Check if it's a cross-page drag
      if (sourceData.pageIndex !== targetData.pageIndex) {
        // Move photo with automatic layout adjustment
        const newPages = movePhotoWithLayoutAdjustment(
          workingPages,
          sourceData.pageIndex,
          sourceData.frameIndex,
          targetData.pageIndex,
          targetData.frameIndex,
          photos
        );
        setWorkingPages(newPages);
        onPagesChange(newPages);
        addEntry({
          operation: 'move_photo_cross_page',
          details: { source: sourceData, target: targetData },
        });
        toast.success('Photo moved and layouts adjusted');
      } else {
        // Same page swap
        const newPages = swapPhotos(
          workingPages,
          sourceData.pageIndex,
          sourceData.frameIndex,
          targetData.pageIndex,
          targetData.frameIndex,
          photos
        );
        setWorkingPages(newPages);
        onPagesChange(newPages);
        addEntry({
          operation: 'swap_photos',
          details: { source: sourceData, target: targetData },
        });
        toast.success('Photos swapped');
      }
    }
  };

  return (
    <>
      {/* Edit Mode Toolbar */}
      <div className="fixed top-16 left-0 right-0 bg-primary/10 backdrop-blur border-b z-50">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            <span className="font-semibold text-primary">Edit Mode</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo}
            >
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
      <SortableContext items={workingPages.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <PageThumbnailStrip
          pages={workingPages}
          currentPage={currentPage}
          onPageSelect={onCurrentPageChange}
          isEditMode={true}
        />
      </SortableContext>
    </>
  );
}
