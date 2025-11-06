import { useState, useCallback } from 'react';
import { EditHistoryEntry, AlbumPage } from '@/lib/types';

interface UseEditHistoryReturn {
  history: EditHistoryEntry[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  addEntry: (entry: Omit<EditHistoryEntry, 'id' | 'timestamp'>) => void;
  undo: () => EditHistoryEntry | null;
  redo: () => EditHistoryEntry | null;
  clear: () => void;
}

export function useEditHistory(): UseEditHistoryReturn {
  const [history, setHistory] = useState<EditHistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const addEntry = useCallback((entry: Omit<EditHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: EditHistoryEntry = {
      ...entry,
      id: `edit-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    };

    setHistory(prev => {
      // Remove any "future" history if we're not at the end
      const newHistory = prev.slice(0, currentIndex + 1);
      return [...newHistory, newEntry];
    });
    
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex < 0) return null;
    const entry = history[currentIndex];
    setCurrentIndex(prev => prev - 1);
    return entry;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex >= history.length - 1) return null;
    const entry = history[currentIndex + 1];
    setCurrentIndex(prev => prev + 1);
    return entry;
  }, [currentIndex, history]);

  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return {
    history,
    currentIndex,
    canUndo: currentIndex >= 0,
    canRedo: currentIndex < history.length - 1,
    addEntry,
    undo,
    redo,
    clear,
  };
}
