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
    const systemPrompt = `You are a professional photobook designer. Create a beautiful, balanced photobook layout.

Available Layouts:
${JSON.stringify(layouts, null, 2)}

Images to arrange:
${JSON.stringify(photos, null, 2)}

Instructions:
1. Match image orientations to layout frames:
   - Portrait images (orientation: "portrait") → Prefer layouts with vertical/tall frames
   - Landscape images (orientation: "landscape") → Prefer layouts with horizontal/wide frames
   - Square images (orientation: "square") → Can fit anywhere
2. Distribute images evenly across pages
3. Use each image only once (no duplicates across pages)
4. Fill frames strategically - it's okay to leave some frames empty if it creates better balance
5. Create visual flow and balance across the photobook
6. frame_number starts at 1 (not 0) and goes up to the frameCount of the chosen layout

Return a structured plan with layout choices and frame assignments.`;

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
