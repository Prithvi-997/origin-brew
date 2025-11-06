import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Copy, Trash2, RefreshCw, Layout } from 'lucide-react';

interface PageOperationsProps {
  onSwapLayout: () => void;
  onRegeneratePage: () => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
  canDelete: boolean;
}

export default function PageOperations({
  onSwapLayout,
  onRegeneratePage,
  onDuplicatePage,
  onDeletePage,
  canDelete,
}: PageOperationsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreVertical className="h-4 w-4 mr-2" />
          Page Options
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onSwapLayout}>
          <Layout className="h-4 w-4 mr-2" />
          Change Layout
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRegeneratePage}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerate with AI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicatePage}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate Page
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={onDeletePage} 
          disabled={!canDelete}
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Page
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
