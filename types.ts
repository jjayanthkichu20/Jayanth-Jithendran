// Represents a geographical coordinate
export interface LatLng {
  latitude: number;
  longitude: number;
}

// Represents a URL with an optional title
export interface GroundingUrl {
  uri: string;
  title?: string;
}

// Represents a single place returned by the API with structured details
export interface Place {
  name: string;
  address: string;
  description: string;
  category: string;
  website?: string; // Optional website URL
}

// Result structure for Gemini Maps Grounding API, now primarily returning a text summary
export interface MapsGroundingResult {
  summary: string; // This will now contain the full model's text response (likely Markdown)
  places: Place[]; // This array will typically be empty when using the Google Maps tool due to API limitations
  urls: GroundingUrl[];
}