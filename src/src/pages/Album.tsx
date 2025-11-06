"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Grid3x3, BookOpen, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Album as AlbumType, AlbumPage, Photo } from "@/lib/types"
import { generateAlbumPagesWithAI } from "@/lib/layoutGenerator"
import { analyzeImage } from "@/lib/imageAnalysis"
import { filterDuplicateFiles } from "@/lib/duplicateDetection"
import SinglePageView from "@/components/album/SinglePageView"
import BookView from "@/components/album/BookView"
import Header from "@/components/Header"
import EditMode from "@/components/album/EditMode"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

type ViewMode = "single" | "book"

const Album = () => {
  const { albumId } = useParams<{ albumId: string }>()
  const navigate = useNavigate()
  const [album, setAlbum] = useState<AlbumType | null>(null)
  const [pages, setPages] = useState<AlbumPage[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("single")
  const [currentPage, setCurrentPage] = useState(0)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isAddingPhotos, setIsAddingPhotos] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadAlbum = async () => {
      if (!albumId) {
        toast.error("Album not found")
        navigate("/")
        return
      }

      // Load album from localStorage (will use backend later)
      const albumData = localStorage.getItem(`album-${albumId}`)
      if (!albumData) {
        toast.error("Album not found")
        navigate("/")
        return
      }

      const parsedAlbum = JSON.parse(albumData)
      setAlbum(parsedAlbum)

      // Use precomputed pages if available, otherwise regenerate
      if (parsedAlbum.pages && parsedAlbum.pages.length > 0) {
        setPages(parsedAlbum.pages)
      } else {
        // Fallback: regenerate from photos (shouldn't happen with new flow)
        const generatedPages = await generateAlbumPagesWithAI(parsedAlbum.photos)
        setPages(generatedPages)
      }
    }

    loadAlbum()
  }, [albumId, navigate])

  if (!album || pages.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your photobook...</p>
        </div>
      </div>
    )
  }

  const totalPages = pages.length

  const handleSaveEdit = (updatedPages: AlbumPage[]) => {
    setPages(updatedPages)
    if (album) {
      const updatedAlbum = {
        ...album,
        pages: updatedPages,
        lastModified: new Date(),
      }
      localStorage.setItem(`album-${albumId}`, JSON.stringify(updatedAlbum))
      setAlbum(updatedAlbum)
    }
    setIsEditMode(false)
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    toast.info("Edit cancelled")
  }

  const handleEnterEditMode = () => {
    if (viewMode !== "book") {
      setViewMode("book")
    }
    setIsEditMode(true)
  }

  const handleAddPhotos = () => {
    fileInputRef.current?.click()
  }

  const handleNewPhotosUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !album) return

    // Filter out duplicates
    const { uniqueFiles, duplicates } = filterDuplicateFiles(files, album.photos)

    if (duplicates.length > 0) {
      toast.warning(
        `Skipped ${duplicates.length} duplicate photo${duplicates.length > 1 ? "s" : ""}: ${duplicates.slice(0, 3).join(", ")}${duplicates.length > 3 ? "..." : ""}`,
      )
    }

    if (uniqueFiles.length === 0) {
      toast.error("All photos are already in the album")
      return
    }

    setIsAddingPhotos(true)
    toast.info(`Adding ${uniqueFiles.length} new photo${uniqueFiles.length > 1 ? "s" : ""}...`)

    try {
      // Analyze new photos
      const newPhotoAnalysis = await Promise.all(uniqueFiles.map((file) => analyzeImage(file)))
      const newPhotos: Photo[] = newPhotoAnalysis.map((analysis, index) => ({
        id: `photo-${Date.now()}-${index}`,
        url: URL.createObjectURL(uniqueFiles[index]),
        originalFilename: uniqueFiles[index].name,
        width: analysis.width,
        height: analysis.height,
        aspectRatio: analysis.aspectRatio,
        orientation: analysis.orientation,
        priority: analysis.priority,
      }))

      // Merge with existing photos
      const allPhotos = [...album.photos, ...newPhotos]

      // Regenerate entire album with AI
      const newPages = await generateAlbumPagesWithAI(allPhotos)

      // Update album with new photos and pages
      const updatedAlbum = {
        ...album,
        photos: allPhotos,
        pages: newPages,
        lastModified: new Date(),
      }

      localStorage.setItem(`album-${albumId}`, JSON.stringify(updatedAlbum))
      setAlbum(updatedAlbum)
      setPages(newPages)
      setCurrentPage(0)

      toast.success(`Added ${uniqueFiles.length} photo${uniqueFiles.length > 1 ? "s" : ""} and regenerated album!`)
    } catch (error) {
      console.error("Error adding photos:", error)
      toast.error("Failed to add photos")
    } finally {
      setIsAddingPhotos(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Top Bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Albums
            </Button>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-semibold">{album.title}</h1>
            {album.subtitle && <p className="text-sm text-muted-foreground">{album.subtitle}</p>}
          </div>

          <div className="flex items-center gap-2">
            {!isEditMode && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddPhotos}
                  disabled={isAddingPhotos}
                  className="gap-2 bg-transparent"
                >
                  <Plus className="h-4 w-4" />
                  {isAddingPhotos ? "Adding..." : "Add Photos"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewMode((prev) => (prev === "single" ? "book" : "single"))}
                  className="gap-2"
                >
                  {viewMode === "single" ? (
                    <>
                      <BookOpen className="h-4 w-4" />
                      Book View
                    </>
                  ) : (
                    <>
                      <Grid3x3 className="h-4 w-4" />
                      Single View
                    </>
                  )}
                </Button>

                {viewMode === "book" && (
                  <Button size="sm" onClick={handleEnterEditMode} className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`container mx-auto px-6 py-8 ${isEditMode ? "pb-32" : ""}`}>
        {isEditMode ? (
          <EditMode
            pages={pages}
            photos={album?.photos || []}
            currentPage={currentPage}
            onPagesChange={setPages}
            onCurrentPageChange={setCurrentPage}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            viewMode={viewMode}
          />
        ) : (
          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-8 pb-8">
              {viewMode === "single"
                ? pages.map((page, index) => (
                    <div key={index} className="scroll-snap-start">
                      <SinglePageView pages={[page]} isEditMode={isEditMode} pageStartIndex={index} />
                    </div>
                  ))
                : Array.from({ length: Math.ceil(totalPages / 2) }, (_, i) => {
                    const leftPage = pages[i * 2]
                    const rightPage = pages[i * 2 + 1]
                    return (
                      <div key={i} className="scroll-snap-start">
                        <BookView
                          pages={[leftPage, rightPage].filter(Boolean)}
                          isEditMode={isEditMode}
                          pageStartIndex={i * 2}
                        />
                      </div>
                    )
                  })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Hidden file input for adding photos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleNewPhotosUpload}
        className="hidden"
      />
    </div>
  )
}

export default Album
