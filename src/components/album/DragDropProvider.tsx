"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  pointerWithin,
  rectIntersection,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragMoveEvent,
} from "@dnd-kit/core";

interface DragDropProviderProps {
  children: ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  overlay?: ReactNode;
}

export default function DragDropProvider({
  children,
  onDragStart,
  onDragEnd,
  overlay,
}: DragDropProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragMove = (event: DragMoveEvent) => {
    const { delta } = event;
    const scrollContainer = document.querySelector(".scroll-area-viewport");

    if (!scrollContainer) return;

    const rect = scrollContainer.getBoundingClientRect();
    const scrollThreshold = 100; // pixels from edge to trigger scroll
    const scrollSpeed = 10; // pixels per frame

    // Get cursor position relative to viewport
    const cursorY =
      event.activatorEvent instanceof MouseEvent
        ? event.activatorEvent.clientY
        : 0;

    // Scroll up if near top
    if (cursorY < rect.top + scrollThreshold) {
      scrollContainer.scrollBy({ top: -scrollSpeed, behavior: "auto" });
    }

    // Scroll down if near bottom
    if (cursorY > rect.bottom - scrollThreshold) {
      scrollContainer.scrollBy({ top: scrollSpeed, behavior: "auto" });
    }
  };

  const collisionDetectionStrategy = (args: any) => {
    // First, try to find droppables where the pointer is directly over
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    // Then try rectangle intersection
    const intersectionCollisions = rectIntersection(args);
    if (intersectionCollisions.length > 0) {
      return intersectionCollisions;
    }

    // Finally fall back to closest center
    return closestCenter(args);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragMove={handleDragMove}
    >
      {children}
      <DragOverlay>{overlay}</DragOverlay>
    </DndContext>
  );
}
