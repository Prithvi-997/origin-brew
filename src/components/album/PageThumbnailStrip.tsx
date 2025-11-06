import { AlbumPage } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"

interface PageThumbnailStripProps {
  pages: AlbumPage[]
  currentPage: number
  onPageSelect: (pageIndex: number) => void
  isEditMode: boolean
  isDraggingPhoto: boolean
}

export default function PageThumbnailStrip({
  pages,
  currentPage,
  onPageSelect,
  isEditMode,
  isDraggingPhoto,
}: PageThumbnailStripProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t py-4 z-40">
      <div className="container mx-auto px-6">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {pages.map((page, index) => (
            <PageThumbnail
              key={page.id}
              page={page}
              index={index}
              isActive={currentPage === index}
              onClick={() => onPageSelect(index)}
              isDraggable={isEditMode}
              isDraggingPhoto={isDraggingPhoto}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface PageThumbnailProps {
  page: AlbumPage
  index: number
  isActive: boolean
  onClick: () => void
  isDraggable: boolean
  isDraggingPhoto: boolean
}

function PageThumbnail({ page, index, isActive, onClick, isDraggable, isDraggingPhoto }: PageThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `page-${page.id}`,
    disabled: !isDraggable,
    data: {
      type: "page",
    },
  })

  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: `thumbnail-${page.id}`,
    data: {
      pageIndex: index,
    },
    disabled: !isDraggingPhoto,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const setRefs = (node: HTMLDivElement | null) => {
    setSortableRef(node)
    setDroppableRef(node)
  }

  return (
    <div
      ref={setRefs}
      style={style}
      {...attributes}
      className={cn("flex-shrink-0 cursor-pointer transition-all", isDragging && "opacity-50 scale-95")}
    >
      <div
        className={cn(
          "w-24 h-28 rounded-lg border-2 overflow-hidden bg-white relative group",
          isActive ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50",
          isOver && isDraggingPhoto && "ring-2 ring-green-500 border-green-500",
        )}
        onClick={onClick}
      >
        <div
          dangerouslySetInnerHTML={{ __html: page.svgContent }}
          className="w-full h-full pointer-events-none"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-1 text-center">
          Page {index + 1}
        </div>
        {isDraggable && (
          <div
            {...listeners}
            className="absolute top-1 right-1 p-1 bg-black/50 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-3 w-3 text-white" />
          </div>
        )}
        {isOver && isDraggingPhoto && (
          <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Drop Here</span>
          </div>
        )}
      </div>
    </div>
  )
}
