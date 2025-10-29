import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MoreVertical, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Header from "@/components/Header";

const Index = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNewAlbum = () => {
    setIsMenuOpen(false);
    navigate("/new-album");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-5xl font-bold text-primary">Album overview</h1>
          
          <div className="flex items-center gap-3">
            <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <PopoverTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  New
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <div className="space-y-1">
                  <button
                    onClick={handleNewAlbum}
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    New album
                  </button>
                  <button
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    New folder
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search" 
                className="w-64 pl-9"
              />
            </div>
          </div>
        </div>

        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-semibold text-primary">
            Welcome Prithvi!
          </h2>
          <p className="text-muted-foreground">
            This is your overview page. Albums and bookmarks will appear here. Photos and videos are stored in high quality.{" "}
            <a href="#" className="text-primary underline">
              Upgrade
            </a>{" "}
            to store the originals.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg bg-muted/50"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
