import { useState } from 'react';
import { AlbumPage, Photo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Save, X, Undo2, Redo2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import PageOperations from './PageOperations';
import LayoutSelector from './LayoutSelector';
import PageThumbnailStrip from './PageThumbnailStrip';
import DragDropProvider from './DragDropProvider';
import { useEditHistory } from '@/hooks/useEditHistory';
import {
  swapPhotos,
  changePageLayout,
  duplicatePage,
  deletePage,
  reorderPages,
} from '@/lib/editOperations';
import { regeneratePages } from '@/lib/pageRegenerator';
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
}

export default function EditMode({
  pages,
  photos,
  currentPage,
  onPagesChange,
  onCurrentPageChange,
  onSave,
  onCancel,
}: EditModeProps) {
  const [workingPages, setWorkingPages] = useState(pages);
  const [layoutSelectorOpen, setLayoutSelectorOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

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

  const handleSwapLayout = () => {
    setLayoutSelectorOpen(true);
  };

  const handleLayoutSelect = (layoutName: string) => {
    const newPages = changePageLayout(workingPages, currentPage, layoutName, photos);
    setWorkingPages(newPages);
    addEntry({
      operation: 'change_layout',
      pageIndex: currentPage,
      details: { layoutName },
    });
    toast.success('Layout changed');
  };

  const handleRegeneratePage = async () => {
    setIsRegenerating(true);
    try {
      const newPages = await regeneratePages(workingPages, [currentPage], photos);
      setWorkingPages(newPages);
      addEntry({
        operation: 'change_layout',
        pageIndex: currentPage,
        details: { regenerated: true },
      });
      toast.success('Page regenerated');
    } catch (error) {
      toast.error('Failed to regenerate page');
      console.error(error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDuplicatePage = () => {
    const newPages = duplicatePage(workingPages, currentPage);
    setWorkingPages(newPages);
    addEntry({
      operation: 'add_page',
      pageIndex: currentPage + 1,
      details: { duplicated: true },
    });
    toast.success('Page duplicated');
  };

  const handleDeletePage = () => {
    if (workingPages.length <= 1) {
      toast.error('Cannot delete the last page');
      return;
    }
    const newPages = deletePage(workingPages, currentPage);
    setWorkingPages(newPages);
    addEntry({
      operation: 'delete_page',
      pageIndex: currentPage,
      details: {},
    });
    if (currentPage >= newPages.length) {
      onCurrentPageChange(newPages.length - 1);
    }
    toast.success('Page deleted');
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedItem(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over) return;

    // Handle page reordering
    if (active.id.toString().startsWith('page-')) {
      const oldIndex = workingPages.findIndex(p => p.id === active.id);
      const newIndex = workingPages.findIndex(p => p.id === over.id);
      
      if (oldIndex !== newIndex) {
        const newPages = reorderPages(workingPages, oldIndex, newIndex);
        setWorkingPages(newPages);
        addEntry({
          operation: 'reorder_pages',
          details: { from: oldIndex, to: newIndex },
        });
        toast.success('Pages reordered');
      }
      return;
    }

    // Handle photo swapping
    const sourceData = active.data.current;
    const targetData = over.data.current;

    if (sourceData && targetData) {
      const newPages = swapPhotos(
        workingPages,
        sourceData.pageIndex,
        sourceData.frameIndex,
        targetData.pageIndex,
        targetData.frameIndex,
        photos
      );
      setWorkingPages(newPages);
      addEntry({
        operation: 'swap_photos',
        details: { source: sourceData, target: targetData },
      });
      toast.success('Photos swapped');
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
            <PageOperations
              onSwapLayout={handleSwapLayout}
              onRegeneratePage={handleRegeneratePage}
              onDuplicatePage={handleDuplicatePage}
              onDeletePage={handleDeletePage}
              canDelete={workingPages.length > 1}
            />
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

      {/* Drag and Drop Context */}
      <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={workingPages.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <PageThumbnailStrip
            pages={workingPages}
            currentPage={currentPage}
            onPageSelect={onCurrentPageChange}
            isEditMode={true}
          />
        </SortableContext>
      </DragDropProvider>

      {/* Layout Selector Modal */}
      <LayoutSelector
        open={layoutSelectorOpen}
        onOpenChange={setLayoutSelectorOpen}
        currentLayout={workingPages[currentPage]?.layoutName || ''}
        frameCount={workingPages[currentPage]?.photoIds?.length}
        onSelectLayout={handleLayoutSelect}
      />
    </>
  );
}
