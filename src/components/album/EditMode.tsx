"use client"

import { useState } from "react"
import type { AlbumPage, Photo } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Save, X, Undo2, Redo2, Pencil } from "lucide-react"
import { toast } from "sonner"
import PageThumbnailStrip from "./PageThumbnailStrip"
import { useEditHistory } from "@/hooks/useEditHistory"
import { swapPhotos, reorderPages, movePhotoWithLayoutAdjustment } from "@/lib/editOperations"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import DragDropProvider from "./DragDropProvider"
import BookView from "./BookView"
import { ScrollArea } from "@/components/ui/scroll-area"

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
    const sourceData = active.data.current
    const targetData = over.data.current

    // Handle dropping a photo onto a page thumbnail
    if (over.id.toString().startsWith("thumbnail-")) {
      const targetPageIndex = over.data.current?.pageIndex
      if (targetPageIndex === undefined) return

      const targetPage = workingPages[targetPageIndex]
      const firstEmptyFrameIndex = targetPage.photos.findIndex((p) => p === null)

      if (firstEmptyFrameIndex === -1) {
        toast.error("This page is full.", {
          description: "Cannot move photo. The target page has no empty frames.",
          duration: 3000,
        })
        return
      }

      const newPages = movePhotoWithLayoutAdjustment(
        workingPages,
        sourceData.pageIndex,
        sourceData.frameIndex,
        targetPageIndex,
        firstEmptyFrameIndex,
        photos,
      )
      setWorkingPages(newPages)
      onPagesChange(newPages)
      addEntry({
        operation: "move_photo_to_page",
        details: {
          source: sourceData,
          target: { pageIndex: targetPageIndex, frameIndex: firstEmptyFrameIndex },
        },
      })
      toast.success("Photo moved to new page")
      return
    }

    console.log("[v0] Drag end - source:", sourceData, "target:", targetData)

    if (sourceData && targetData) {
      // Check if it's a cross-page drag
      if (sourceData.pageIndex !== targetData.pageIndex) {
        const targetPage = workingPages[targetData.pageIndex]
        const targetPagePhotoCount = targetPage.photos.filter((p) => p !== null).length

        console.log("[v0] Cross-page drag - target page has", targetPagePhotoCount, "photos")

        if (targetData.photoUrl) {
          // Target frame has a photo - just swap the photos, keep layouts unchanged
          console.log("[v0] Target frame has photo - swapping without layout change")
          const newPages = swapPhotos(
            workingPages,
            sourceData.pageIndex,
            sourceData.frameIndex,
            targetData.pageIndex,
            targetData.frameIndex,
            photos,
          )
          setWorkingPages(newPages)
          onPagesChange(newPages)
          addEntry({
            operation: "swap_photos",
            details: { source: sourceData, target: targetData, crossPage: true },
          })
          toast.success("Photos swapped")
        } else {
          if (targetPagePhotoCount >= 6) {
            toast.error("Only 6 images per page are allowed", {
              description: "The target page is full. Please choose a different page.",
              duration: 3000,
            })
            return // Don't process the drop, image stays at source
          }

          console.log("[v0] Target frame is empty - moving with layout adjustment")
          // Move photo with automatic layout adjustment
          const newPages = movePhotoWithLayoutAdjustment(
            workingPages,
            sourceData.pageIndex,
            sourceData.frameIndex,
            targetData.pageIndex,
            targetData.frameIndex,
            photos,
          )
          setWorkingPages(newPages)
          onPagesChange(newPages)
          addEntry({
            operation: "move_photo_cross_page",
            details: { source: sourceData, target: targetData },
          })
          toast.success("Photo moved and layouts adjusted")
        }
      } else {
        // Same page swap
        const newPages = swapPhotos(
          workingPages,
          sourceData.pageIndex,
          sourceData.frameIndex,
          targetData.pageIndex,
          targetData.frameIndex,
          photos,
        )
        setWorkingPages(newPages)
        onPagesChange(newPages)
        addEntry({
          operation: "swap_photos",
          details: { source: sourceData, target: targetData },
        })
        toast.success("Photos swapped")
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
