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

CRITICAL DESIGN PRINCIPLES:

1. PHOTO-TO-FRAME MATCHING (Highest Priority):
   - Match portrait photos (aspectRatio < 0.85) to portrait frames (aspect_ratio < 0.9)
   - Match landscape photos (aspectRatio > 1.25) to landscape frames (aspect_ratio > 1.2)
   - Match square photos (0.85-1.15) to square frames (0.9-1.1)
   - Prioritize close aspect ratio matches (within 0.2 difference is ideal)
   - High-priority photos deserve prominent placement (larger frames or hero layouts like singlephoto.svg)

2. LAYOUT DIVERSITY & RHYTHM:
   - Create visual rhythm: busy multi-photo page → calm single-photo page → busy page
   - NEVER use the same layout more than 2 times consecutively
   - Vary between dense layouts (6+ photos) and spacious layouts (1-3 photos)
   - Use single-photo layouts (singlephoto.svg) for the highest priority images
   - Rotate through different frame counts (3, 4, 5, 6 photos per page)

3. VISUAL STORYTELLING:
   - Group related photos by orientation patterns (all portraits, all landscapes, mixed)
   - Create breathing room - follow dense pages with simpler layouts
   - Place hero images (highest priority) at strategic points (opening, middle, closing pages)
   - Consider visual weight distribution across facing pages in a book spread

4. TECHNICAL REQUIREMENTS:
   - Every photo must be used exactly once
   - Fill all frames in each chosen layout
   - Ensure frame count matches available photos for each page

5. QUALITY OVER QUANTITY:
   - Prioritize perfect aspect ratio matches over using a specific layout
   - If a photo doesn't fit well in any frame on a page, choose a different layout
   - Aim for <0.15 aspect ratio difference between photo and frame when possible

Your response should use the create_photobook_plan function to return a complete, optimized plan that creates a visually stunning photobook.`;

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
