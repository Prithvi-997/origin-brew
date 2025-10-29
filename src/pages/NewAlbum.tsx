import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const NewAlbum = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [useOldEditor, setUseOldEditor] = useState(false);

  const handleUploadPhotos = () => {
    // Handle photo upload logic
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        console.log('Selected files:', files);
        // Handle the uploaded files here
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
