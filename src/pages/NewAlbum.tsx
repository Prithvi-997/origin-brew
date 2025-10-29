import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { analyzeImage } from "@/lib/imageAnalysis";
import { generateAlbumPagesWithAI } from "@/lib/layoutGenerator";
import { Photo } from "@/lib/types";

const NewAlbum = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [useOldEditor, setUseOldEditor] = useState(false);

  const handleUploadPhotos = () => {
    if (!title.trim()) {
      toast.error("Please enter a title for your album");
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        toast.success(`${files.length} photos uploaded successfully!`);
        
        try {
          // Step 1: Analyze images
          toast.info("Analyzing your photos...");
          const analyzedPhotos: Photo[] = await Promise.all(
            Array.from(files).map(async (file, index) => {
              const analysis = await analyzeImage(file);
              return {
                id: `photo-${Date.now()}-${index}`,
                url: URL.createObjectURL(file),
                originalFilename: file.name,
                width: analysis.width,
                height: analysis.height,
                aspectRatio: analysis.aspectRatio,
                orientation: analysis.orientation,
              };
            })
          );

          // Step 2: Generate pages with AI
          toast.info("Creating intelligent layouts with AI...");
          const generatedPages = await generateAlbumPagesWithAI(analyzedPhotos);

          // Step 3: Store and navigate
          const albumId = `album-${Date.now()}`;
          const albumData = {
            id: albumId,
            title,
            subtitle,
            photos: analyzedPhotos,
            pages: generatedPages,
            createdAt: new Date().toISOString(),
          };

          localStorage.setItem(`album-${albumId}`, JSON.stringify(albumData));
          toast.success("Your photobook is ready!");
          navigate(`/album/${albumId}`);
        } catch (error) {
          console.error('Error creating album:', error);
          toast.error("Failed to create photobook. Please try again.");
        }
      }
    };
    input.click();
  };

  return (
    <div 
      className="relative flex min-h-screen items-center justify-center"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073')",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      <div className="absolute inset-0 bg-black/20" />
      
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <h2 className="mb-2 text-center text-3xl font-semibold text-primary">
          New album
        </h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          What is your album about? Give your album a fitting title and subtitle.
        </p>

        <div className="space-y-4">
          <div>
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-2"
            />
          </div>

          <div>
            <Input
              placeholder="Subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="border-2"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="oldEditor"
              checked={useOldEditor}
              onCheckedChange={(checked) => setUseOldEditor(checked as boolean)}
            />
            <Label
              htmlFor="oldEditor"
              className="text-sm font-normal text-muted-foreground cursor-pointer"
            >
              Use old editor
            </Label>
          </div>

          <Button
            onClick={handleUploadPhotos}
            className="w-full bg-primary/20 text-primary hover:bg-primary/30 rounded-full py-6 text-base"
          >
            Upload photos
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewAlbum;
