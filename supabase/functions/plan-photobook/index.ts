import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { layouts, photos } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Planning photobook for ${photos.length} photos with ${Object.keys(layouts).length} layouts`);

    // Build prompt for AI
    const systemPrompt = `You are an expert photobook designer with deep knowledge of visual composition, storytelling, and layout design. Your task is to create a beautiful, well-balanced photobook that tells a compelling visual story.

Available layouts and their characteristics:
${JSON.stringify(layouts, null, 2)}

Photos to arrange (with orientation, aspect ratio, and priority):
${JSON.stringify(photos, null, 2)}

CRITICAL ASPECT RATIO MATCHING RULES (Highest Priority):

1. PHOTO CLASSIFICATION:
   - Full-length portraits: aspectRatio < 0.65 (e.g., 0.45, 0.55, 0.60) - tall vertical photos showing full body
   - Regular portraits: aspectRatio 0.65-0.85 (e.g., 0.70, 0.75, 0.80) - standard portrait orientation
   - Square-ish: aspectRatio 0.85-1.15 (e.g., 0.90, 1.0, 1.10) - square or nearly square
   - Landscape: aspectRatio 1.15-1.6 (e.g., 1.25, 1.33, 1.50) - horizontal orientation
   - Wide landscape/panoramic: aspectRatio > 1.6 (e.g., 1.78, 2.0, 2.5) - very wide photos

2. OPTIMAL FRAME MATCHING FOR EACH PHOTO TYPE:

   For FULL-LENGTH PORTRAITS (aspectRatio < 0.65):
   ✅ BEST MATCHES:
      - layout5.svg frame 1 (aspect 0.49) - Perfect for full-length portraits!
      - layout2.svg frame 2 (aspect 0.65) - Excellent fit
      - layout10.svg frame 5 (aspect 0.48) - Great for tall photos
      - layout13.svg frame 4 (aspect 0.45) - Perfect tall frame
      - layout14.svg frame 1 (aspect 0.65) - Good portrait frame
   ❌ NEVER USE:
      - Landscape frames (aspect > 1.2) - Will crop faces and body badly
      - Square frames (aspect 0.9-1.1) - Will force severe cropping
      - Wide frames (aspect > 1.5) - Absolutely unsuitable
   
   For REGULAR PORTRAITS (aspectRatio 0.65-0.85):
   ✅ BEST MATCHES:
      - layout2.svg frames 1,2 (aspect 0.79, 0.65)
      - layout5.svg frame 1 (aspect 0.49) if photo aspect < 0.7
      - layout8.svg frame 4 (aspect 0.76)
      - layout10.svg frame 3 (aspect 0.54) if photo aspect < 0.7
      - layout18.svg frame 1 (aspect 0.76)
   
   For SQUARE PHOTOS (aspectRatio 0.85-1.15):
   ✅ BEST MATCHES:
      - layout2.svg frames 3,4 (aspect 1.0)
      - layout3.svg frames 1,2 (aspect 1.0)
      - layout5.svg frames 2,3 (aspect 1.0)
      - layout6.svg all frames (aspect 1.0)
      - layout8.svg frames 3,5 (aspect 1.0)
   
   For LANDSCAPE PHOTOS (aspectRatio 1.15-1.6):
   ✅ BEST MATCHES:
      - layout1.svg frames 1,2,3 (aspect 1.44, 1.54, 1.54)
      - layout3.svg frame 3 (aspect 1.43)
      - layout7.svg all frames (aspect 1.43)
      - layout8.svg frames 1,2 (aspect 1.43)
   
   For WIDE PANORAMIC (aspectRatio > 1.6):
   ✅ BEST MATCHES:
      - layout4.svg frames 1,2 (aspect 2.05)
      - layout1.svg frame 5 (aspect 2.35)
      - layout9.svg frame 3 (aspect 2.75)
      - layout13.svg frame 1 (aspect 2.44)
      - layout17.svg frame 1 (aspect 2.61)

3. ASPECT RATIO FIT SCORING SYSTEM:
   Calculate fit score for each photo-to-frame assignment:
   - aspectDiff = |photo.aspectRatio - frame.aspect_ratio|
   - Perfect match (aspectDiff < 0.10): +100 points
   - Excellent match (0.10 ≤ aspectDiff < 0.15): +90 points
   - Good match (0.15 ≤ aspectDiff < 0.20): +80 points
   - Acceptable (0.20 ≤ aspectDiff < 0.30): +60 points
   - Poor match (0.30 ≤ aspectDiff < 0.50): +30 points
   - Terrible match (aspectDiff ≥ 0.50): -50 points (AVOID!)

4. CRITICAL PENALTY SYSTEM (Apply these penalties):
   - Portrait (aspect < 0.85) in landscape frame (aspect > 1.2): -100 penalty
   - Landscape (aspect > 1.15) in portrait frame (aspect < 0.85): -80 penalty
   - Full-length portrait (aspect < 0.65) in square/landscape frame: -150 penalty
   - Any mismatch with aspectDiff > 0.5: -100 penalty
   - Using same layout 3+ times in a row: -50 penalty per occurrence

5. LAYOUT SELECTION STRATEGY:
   Step 1: Analyze photo collection
   - Count full-length portraits (aspect < 0.65)
   - Count regular portraits (aspect 0.65-0.85)
   - Count landscapes (aspect > 1.15)
   - Count panoramics (aspect > 1.6)
   
   Step 2: Prioritize layouts based on content
   - If full-length portraits ≥ 3: Heavily prioritize layout5.svg, layout2.svg, layout10.svg, layout13.svg, layout14.svg
   - If portraits ≥ 5: Use portrait-friendly layouts (layout2, layout5, layout8, layout12, layout14, layout18)
   - If landscapes ≥ 5: Use landscape-friendly layouts (layout1, layout4, layout7, layout9, layout11)
   - If panoramics ≥ 2: Reserve layout4.svg, layout9.svg frame 3, layout13.svg frame 1
   - For highest priority photos: Consider singlephoto.svg (full page impact)

6. FRAME-BY-FRAME EVALUATION PROCESS:
   For each photo assignment:
   a) Calculate fit score with target frame
   b) If fit score < 50, search for better frame in current layout
   c) If no good frame in current layout, switch to different layout
   d) NEVER assign a photo if penalty would apply
   e) Prioritize visual quality over completing a specific page

7. VISUAL QUALITY REQUIREMENTS:
   - Faces must be fully visible (no cropping at neck, forehead, or sides)
   - Full-length portrait bodies should be fully contained
   - Prefer slight white space (letterboxing) over aggressive face cropping
   - Aspect difference > 0.4 is unacceptable for portraits
   - Ensure breathing room: alternate dense pages (5-7 photos) with sparse pages (1-3 photos)

8. LAYOUT DIVERSITY & RHYTHM:
   - NEVER use the same layout more than 2 times consecutively
   - Create visual rhythm: busy page → calm page → busy page
   - Rotate through different frame counts (1, 2, 3, 4, 5, 6 photos per page)
   - Use singlephoto.svg for highest priority images
   - Balance portrait-heavy and landscape-heavy pages

9. TECHNICAL REQUIREMENTS:
   - Every photo must be used exactly once
   - Fill ALL frames in each chosen layout (no empty frames allowed)
   - Validate frame_number is between 1 and layout.frameCount
   - CRITICAL: If layout has N frames, you MUST use ALL frame numbers 1 through N
   - NEVER skip frame numbers (e.g., don't use frames 1,2,4 if layout has 4 frames - use 1,2,3,4)
   - Frame count for each layout:
${Object.entries(layouts).map(([name, layout]: [string, any]) => `     * ${name}: ${layout.frameCount} frames (must use frames 1-${layout.frameCount})`).join('\n')}

MANDATORY VALIDATION BEFORE RETURNING PLAN (CRITICAL):
You MUST validate every photo-to-frame assignment before returning your plan:

Step 1: For each photo assignment, calculate:
   - aspectDiff = |photo.aspectRatio - frame.aspect_ratio|

Step 2: REJECT any assignment where:
   ❌ Portrait photo (aspect < 0.85) goes into landscape frame (aspect > 1.2)
   ❌ Landscape photo (aspect > 1.15) goes into portrait frame (aspect < 0.85)  
   ❌ aspectDiff > 0.5 for any photo
   ❌ Group photos (wide/landscape) in portrait frames

Step 3: If a photo doesn't fit ANY frame in your chosen layout:
   - CHANGE THE LAYOUT to find better frames
   - DO NOT force the assignment

Step 4: Self-check every page:
   For each assignment ask yourself:
   1. Is this photo portrait/landscape/square?
   2. Is this frame portrait/landscape/square?
   3. Do their orientations match?
   4. Is aspectDiff < 0.5?
   If ANY answer is NO → Reassign the photo immediately

GROUP PHOTOS (HIGHEST PRIORITY RULE):
- Group photos are typically wide/landscape (aspect ratio > 1.2)
- NEVER EVER place group photos in portrait frames (aspect < 0.85)
- ALWAYS use layouts with landscape/wide frames for group photos
- Prioritize showing faces - avoid severe cropping
- If in doubt, use wider frames for group shots

QUALITY OVER COMPLETION:
- It's better to leave a frame empty than to create a terrible mismatch
- Never sacrifice visual quality to fill a specific layout
- If no good match exists, use a different layout

Your response should use the create_photobook_plan function to return a complete, validated, optimized plan that creates a visually stunning photobook with perfect photo-to-frame matching.`;

    // Call Lovable AI with tool calling for structured output
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Create a photobook layout plan for these images.' }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_photobook_plan",
              description: "Return page layouts with frame assignments for a photobook",
              parameters: {
                type: "object",
                properties: {
                  pages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        layout_to_use: {
                          type: "string",
                          description: "Name of the layout template (e.g., 'layout3.svg')"
                        },
                        frames: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              frame_number: {
                                type: "integer",
                                minimum: 1,
                                description: "Frame index in the SVG (1-based, must be <= frameCount)"
                              },
                              image_id: {
                                type: "string",
                                description: "ID of the photo to place in this frame"
                              }
                            },
                            required: ["frame_number", "image_id"],
                            additionalProperties: false
                          }
                        }
                      },
                      required: ["layout_to_use", "frames"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["pages"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_photobook_plan" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI usage limit reached. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI response received:', JSON.stringify(aiResponse, null, 2));

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== 'create_photobook_plan') {
      throw new Error('Invalid AI response: no tool call found');
    }

    const plan = JSON.parse(toolCall.function.arguments);
    console.log(`Generated plan with ${plan.pages.length} pages`);

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in plan-photobook function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
