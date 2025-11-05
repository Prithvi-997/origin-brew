import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import layoutsMetadata from '@/lib/layouts.json';
import { cn } from '@/lib/utils';

interface LayoutSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLayout: string;
  frameCount?: number;
  onSelectLayout: (layoutName: string) => void;
}

export default function LayoutSelector({
  open,
  onOpenChange,
  currentLayout,
  frameCount,
  onSelectLayout,
}: LayoutSelectorProps) {
  const [selectedLayout, setSelectedLayout] = useState(currentLayout);

  // Filter layouts by frame count if specified
  const availableLayouts = Object.entries(layoutsMetadata).filter(([_, metadata]) => {
    if (frameCount) {
      return metadata.frameCount === frameCount;
    }
    return true;
  });

  const handleSelect = () => {
    onSelectLayout(selectedLayout);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose a Layout</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] pr-4">
          <div className="grid grid-cols-3 gap-4">
            {availableLayouts.map(([layoutName, metadata]) => (
              <button
                key={layoutName}
                onClick={() => setSelectedLayout(layoutName)}
                className={cn(
                  "p-4 border-2 rounded-lg hover:border-primary transition-colors",
                  selectedLayout === layoutName ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <div className="aspect-[5/6] bg-muted rounded mb-2 flex items-center justify-center">
                  <img
                    src={`/src/assets/layouts/${layoutName}`}
                    alt={metadata.description}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-sm font-medium">{metadata.description}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {metadata.frameCount} {metadata.frameCount === 1 ? 'photo' : 'photos'}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={selectedLayout === currentLayout}>
            Apply Layout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
