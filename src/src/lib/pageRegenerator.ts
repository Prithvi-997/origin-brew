import type { AlbumPage, Photo } from "./types"
import { supabase } from "@/integrations/supabase/client"
import { injectImagesIntoSVG, uniquifySVGIds } from "./svgUtils"
import layoutsMetadata from "./layouts.json"

// Import all layout SVG files
import layout8 from "@/assets/layouts/layout8.svg?raw"
import layout9 from "@/assets/layouts/layout9.svg?raw"
import layout10 from "@/assets/layouts/layout10.svg?raw"
import layout11 from "@/assets/layouts/layout11.svg?raw"
import layout12 from "@/assets/layouts/layout12.svg?raw"
import layout13 from "@/assets/layouts/layout13.svg?raw"
import layout14 from "@/assets/layouts/layout14.svg?raw"
import layout15 from "@/assets/layouts/layout15.svg?raw"
import layout16 from "@/assets/layouts/layout16.svg?raw"
import layout17 from "@/assets/layouts/layout17.svg?raw"
import layout18 from "@/assets/layouts/layout18.svg?raw"
import layout19 from "@/assets/layouts/layout19.svg?raw"
import layout20 from "@/assets/layouts/layout20.svg?raw"
import layout21 from "@/assets/layouts/layout21.svg?raw"
import layout22 from "@/assets/layouts/layout22.svg?raw"
import layout23 from "@/assets/layouts/layout23.svg?raw"
import layout24 from "@/assets/layouts/layout24.svg?raw"

const layoutTemplates: Record<string, string> = {
  "layout8.svg": layout8,
  "layout9.svg": layout9,
  "layout10.svg": layout10,
  "layout11.svg": layout11,
  "layout12.svg": layout12,
  "layout13.svg": layout13,
  "layout14.svg": layout14,
  "layout15.svg": layout15,
  "layout16.svg": layout16,
  "layout17.svg": layout17,
  "layout18.svg": layout18,
  "layout19.svg": layout19,
  "layout20.svg": layout20,
  "layout21.svg": layout21,
  "layout22.svg": layout22,
  "layout23.svg": layout23,
  "layout24.svg": layout24,
}

/**
 * Regenerate specific pages using AI
 */
export async function regeneratePages(
  pages: AlbumPage[],
  pageIndices: number[],
  photos: Photo[],
  keepLayouts = false,
): Promise<AlbumPage[]> {
  try {
    // Get photos for the pages to regenerate
    const pagesToRegenerate = pageIndices.map((index) => pages[index])
    const photoIdsToUse = pagesToRegenerate.flatMap((page) => page.photoIds || [])
    const photosToUse = photos.filter((photo) => photoIdsToUse.includes(photo.id))

    if (photosToUse.length === 0) {
      throw new Error("No photos found for regeneration")
    }

    // Prepare metadata
    const photoMetadata = photosToUse.map((photo) => ({
      id: photo.id,
      orientation: photo.orientation || "square",
      aspectRatio: photo.aspectRatio || 1,
    }))

    // Call AI to regenerate
    const { data, error } = await supabase.functions.invoke("plan-photobook", {
      body: {
        layouts: layoutsMetadata,
        photos: photoMetadata,
        keepLayouts: keepLayouts ? pagesToRegenerate.map((p) => p.layoutName) : undefined,
      },
    })

    if (error) throw error

    const plan = data as {
      pages: Array<{ layout_to_use: string; frames: Array<{ frame_number: number; image_id: string }> }>
    }

    // Generate new pages
    const newPages = plan.pages.map((pagePlan, index) => {
      const layoutName = pagePlan.layout_to_use
      const layoutTemplate = layoutTemplates[layoutName]

      if (!layoutTemplate) {
        console.error(`Layout ${layoutName} not found`)
        return pagesToRegenerate[index]
      }

      const pagePhotos = pagePlan.frames
        .map((frame) => {
          const photo = photosToUse.find((p) => p.id === frame.image_id)
          return photo
        })
        .filter(Boolean) as Photo[]

      const pageId = pagesToRegenerate[index].id
      const uniqueSVG = uniquifySVGIds(layoutTemplate, pageId)
      const photosMap = new Map(pagePhotos.map((p) => [p.id, p]))
      const assignments = pagePlan.frames.map((frame) => ({
        frameNumber: frame.frame_number,
        photoId: frame.image_id,
      }))
      const svgContent = injectImagesIntoSVG(uniqueSVG, assignments, photosMap)

      return {
        id: pageId,
        pageNumber: pagesToRegenerate[index].pageNumber,
        layoutName,
        svgContent,
        photoIds: pagePhotos.map((p) => p.id),
      }
    })

    // Replace the regenerated pages
    const updatedPages = [...pages]
    pageIndices.forEach((pageIndex, i) => {
      updatedPages[pageIndex] = newPages[i]
    })

    return updatedPages
  } catch (error) {
    console.error("Failed to regenerate pages:", error)
    throw error
  }
}
