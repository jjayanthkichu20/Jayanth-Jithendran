import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { type MapsGroundingResult, type LatLng, type Place } from "../types";

/**
 * Fetches information about a specified location using Gemini API with Google Maps grounding.
 * @param targetLatLng The latitude and longitude of the target location for the search.
 * @param query The prompt to send to the Gemini model.
 * @returns A promise that resolves to MapsGroundingResult containing text and extracted URLs. Structured places will not be returned due to API limitations.
 */
export async function getPlaceInfo(
  targetLatLng: LatLng,
  query: string,
): Promise<MapsGroundingResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Use a default prompt if none is provided, or if it's empty after trimming.
  const effectiveQuery =
    query.trim() ||
    `List key points of interest, famous landmarks, popular restaurants, and other notable locations in this area. Include details like address and a brief description for each. Provide comprehensive details.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: effectiveQuery,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: targetLatLng.latitude,
              longitude: targetLatLng.longitude,
            },
          },
        },
        // IMPORTANT: responseMimeType and responseSchema are NOT supported with the Google Maps tool.
        // The model's output will be plain text (likely Markdown).
        // responseMimeType: "application/json",
        // responseSchema: {
        //   type: Type.OBJECT,
        //   properties: {
        //     summary: {
        //       type: Type.STRING,
        //       description: 'A general summary of the search results.',
        //     },
        //     places: {
        //       type: Type.ARRAY,
        //       items: {
        //         type: Type.OBJECT,
        //         properties: {
        //           name: {
        //             type: Type.STRING,
        //             description: 'The name of the place.',
        //           },
        //           address: {
        //             type: Type.STRING,
        //             description: 'The full address of the place.',
        //           },
        //           description: {
        //             type: Type.STRING,
        //             description: 'A brief description of the place.',
        //           },
        //           category: {
        //             type: Type.STRING,
        //             description: 'The category of the place (e.g., Restaurant, Shop, Landmark).',
        //           },
        //           website: {
        //             type: Type.STRING,
        //             description: 'Optional website URL for the place.',
        //           },
        //         },
        //         required: ['name', 'address', 'description', 'category'],
        //         propertyOrdering: ['name', 'address', 'description', 'category', 'website'],
        //       },
        //     },
        //   },
        //   required: ['places'], // At least an empty array of places is expected
        //   propertyOrdering: ['summary', 'places'],
        // },
      },
    });

    // The response text is now the primary output.
    const summary = response.text.trim();
    // Structured places cannot be reliably parsed without responseSchema.
    const places: Place[] = [];

    const urls: { uri: string; title?: string }[] = [];

    // Extract URLs from groundingChunks
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      for (const chunk of response.candidates[0].groundingMetadata.groundingChunks) {
        if (chunk.maps) {
          if (chunk.maps.uri) {
            urls.push({ uri: chunk.maps.uri, title: chunk.maps.title });
          }
          if (chunk.maps.placeAnswerSources) {
            for (const source of chunk.maps.placeAnswerSources) {
              if (source.reviewSnippets) {
                for (const snippet of source.reviewSnippets) {
                  if (snippet.uri) {
                    urls.push({ uri: snippet.uri }); // Review snippets might not have titles
                  }
                }
              }
            }
          }
        }
      }
    }
    // Deduplicate URLs based on URI
    const uniqueUrls = Array.from(new Map(urls.map((item) => [item.uri, item])).values());
    return { summary, places, urls: uniqueUrls };
  } catch (error) {
    console.error("Error fetching place info from Gemini:", error);
    throw new Error("Failed to fetch information. Please check your network and try again.");
  }
}