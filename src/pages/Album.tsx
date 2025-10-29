import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Grid3x3, BookOpen, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Album as AlbumType, AlbumPage } from "@/lib/types";
import { generateAlbumPages, generateAlbumPagesWithAI } from "@/lib/layoutGenerator";
import SinglePageView from "@/components/album/SinglePageView";
import BookView from "@/components/album/BookView";
import Header from "@/components/Header";
import EditMode from "@/components/album/EditMode";
import { toast } from "sonner";

type ViewMode = 'single' | 'book';

const Album = () => {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<AlbumType | null>(null);
  const [pages, setPages] = useState<AlbumPage[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [currentPage, setCurrentPage] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const loadAlbum = async () => {
      if (!albumId) {
        toast.error("Album not found");
        navigate("/");
        return;
      }

      // Load album from localStorage (will use backend later)
      const albumData = localStorage.getItem(`album-${albumId}`);
      if (!albumData) {
        toast.error("Album not found");
        navigate("/");
        return;
      }

      const parsedAlbum = JSON.parse(albumData);
      setAlbum(parsedAlbum);

      // Use precomputed pages if available, otherwise regenerate
      if (parsedAlbum.pages && parsedAlbum.pages.length > 0) {
        setPages(parsedAlbum.pages);
      } else {
        // Fallback: regenerate from photos (shouldn't happen with new flow)
        const generatedPages = await generateAlbumPagesWithAI(parsedAlbum.photos);
        setPages(generatedPages);
      }
    };

    loadAlbum();
  }, [albumId, navigate]);

  if (!album || pages.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your photobook...</p>
        </div>
      </div>
    );
  }

  const totalPages = pages.length;
  const pagesPerView = viewMode === 'book' ? 2 : 1;
  const maxPageIndex = Math.max(0, totalPages - pagesPerView);

  const handlePrevious = () => {
    setCurrentPage(prev => Math.max(0, prev - pagesPerView));
  };

  const handleNext = () => {
    setCurrentPage(prev => Math.min(maxPageIndex, prev + pagesPerView));
  };

  const getCurrentPages = () => {
    if (viewMode === 'book') {
      return [pages[currentPage], pages[currentPage + 1]].filter(Boolean);
    }
    return [pages[currentPage]];
  };

  const handleSaveEdit = (updatedPages: AlbumPage[]) => {
    setPages(updatedPages);
    if (album) {
      const updatedAlbum = {
        ...album,
        pages: updatedPages,
        lastModified: new Date(),
      };
      localStorage.setItem(`album-${albumId}`, JSON.stringify(updatedAlbum));
      setAlbum(updatedAlbum);
    }
    setIsEditMode(false);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    toast.info('Edit cancelled');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {isEditMode && (
        <EditMode
          pages={pages}
          photos={album?.photos || []}
          currentPage={currentPage}
          onPagesChange={setPages}
          onCurrentPageChange={setCurrentPage}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      )}
      
      {/* Top Bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Albums
          </Button>
          
          <div className="text-center">
            <h1 className="text-2xl font-semibold">{album.title}</h1>
            {album.subtitle && (
              <p className="text-sm text-muted-foreground">{album.subtitle}</p>
            )}
          </div>

          <div className="w-32" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content */}
      <div className={`container mx-auto px-6 py-8 ${isEditMode ? 'pb-32' : ''}`}>
        {/* View Mode Content */}
        <div className="mb-8">
          {viewMode === 'single' ? (
            <SinglePageView pages={getCurrentPages()} />
          ) : (
            <BookView pages={getCurrentPages()} />
          )}
        </div>

        {/* Navigation */}
        {!isEditMode && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} {viewMode === 'book' && currentPage + 1 < totalPages && `- ${currentPage + 2}`} of {totalPages}
            </span>
            
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={currentPage >= maxPageIndex}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      {!isEditMode && (
        <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3">
          <Button
            size="lg"
            onClick={() => setIsEditMode(true)}
            className="rounded-full shadow-lg"
          >
            <Pencil className="mr-2 h-5 w-5" />
            Edit
          </Button>
          
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setViewMode(prev => prev === 'single' ? 'book' : 'single')}
            className="rounded-full shadow-lg"
          >
            {viewMode === 'single' ? (
              <>
                <BookOpen className="mr-2 h-5 w-5" />
                Book View
              </>
            ) : (
              <>
                <Grid3x3 className="mr-2 h-5 w-5" />
                Single View
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Album;
