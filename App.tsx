import React, { useState, useEffect, useCallback } from 'react';
import { getPlaceInfo } from './services/geminiService';
import { type MapsGroundingResult, type LatLng, type Place } from './types';
import MarkdownRenderer from './components/MarkdownRenderer';

const App: React.FC = () => {
  const defaultKottayamCoords: LatLng = { latitude: 9.5916, longitude: 76.5050 }; // Approximate center of Kottayam
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [actualUserLocationDetermined, setActualUserLocationDetermined] = useState<boolean>(false);
  const [searchContext, setSearchContext] = useState<'kottayam' | 'currentLocation'>('kottayam');
  const [prompt, setPrompt] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [generalSummary, setGeneralSummary] = useState<string | undefined>(undefined); // For overall summary (now the full model text response)
  // Structured place results are no longer supported with Google Maps tool due to API limitations
  const [searchResults] = useState<Place[]>([]); // This will always be empty
  const [selectedPlace] = useState<Place | null>(null); // This will always be null
  const [responseUrls, setResponseUrls] = useState<MapsGroundingResult['urls']>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Define filter options
  const filterOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'companies_shops', label: 'Companies & Shops' },
    { value: 'restaurants', label: 'Restaurants' },
    { value: 'attractions', label: 'Attractions & Landmarks' },
    { value: 'hotels', label: 'Hotels & Accommodations' },
    { value: 'services', label: 'Services (e.g., banks, hospitals)' },
  ];

  // Get user's current geolocation on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(coords);
          setActualUserLocationDetermined(true);
          setError(null);
        },
        (geoError) => {
          console.error("Geolocation error:", geoError.message, "Code:", geoError.code, geoError);
          let errorMessage = `Geolocation failed (Code: ${geoError.code}):`;
          if (geoError.code === geoError.PERMISSION_DENIED) {
            errorMessage = `Permission denied.`;
          } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
            errorMessage = `Position unavailable.`;
          } else if (geoError.code === geoError.TIMEOUT) {
            errorMessage = `Request timed out.`;
          }
          const finalErrorMessage = `${errorMessage} You can still search for "Kottayam City". To search "Near My Current Location", please grant geolocation permission or ensure location services are enabled.`;
          setError(finalErrorMessage);
          setUserLocation(defaultKottayamCoords);
          setActualUserLocationDetermined(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      const finalErrorMessage = "Geolocation is not supported by your browser. You can only search for 'Kottayam City'.";
      setError(finalErrorMessage);
      setUserLocation(defaultKottayamCoords);
      setActualUserLocationDetermined(false);
      setSearchContext('kottayam');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(async () => {
    let targetCoords: LatLng | null = null;
    let locationDescription = '';

    if (searchContext === 'kottayam') {
      targetCoords = defaultKottayamCoords;
      locationDescription = 'Kottayam city';
    } else if (searchContext === 'currentLocation') {
      if (actualUserLocationDetermined && userLocation) {
        targetCoords = userLocation;
        locationDescription = 'your current location';
      } else {
        setError("Your current location could not be determined. Please select 'Kottayam City' or enable geolocation.");
        return;
      }
    }

    if (!targetCoords) {
      setError("Unable to determine search location. Please try again.");
      return;
    }

    setLoading(true);
    setError(null);
    setGeneralSummary(undefined);
    // searchResults and selectedPlace are no longer relevant for structured data
    // setSearchResults([]);
    // setSelectedPlace(null);
    setResponseUrls([]);

    // Construct the effective query based on user prompt and filter category
    // NOTE: Due to API limitations, structured JSON output is not supported with Google Maps tool.
    // The model will provide a detailed text response, which will be rendered as a summary.
    let effectiveQuery = `You are a helpful assistant providing local information. Provide a detailed overview of places based on the user's request.
    For each place, include its name, comprehensive address, a detailed description, and its category (e.g., Restaurant, Shop, Landmark). If available, also include a website.
    Always prioritize comprehensive details for each listed place.
    `;

    const currentAreaName = searchContext === 'kottayam' ? 'Kottayam city' : 'this area near my current location';
    const filterLabel = filterOptions.find(opt => opt.value === filterCategory)?.label;

    if (prompt.trim()) {
      effectiveQuery += `The user is looking for: "${prompt.trim()}".`;
    }

    if (filterCategory !== 'all') {
      effectiveQuery += ` Specifically focus on results in the "${filterLabel?.toLowerCase()}" category.`;
    } else {
      effectiveQuery += ` Include various types of places such as companies, shops, restaurants, attractions, and services.`;
    }
    effectiveQuery += ` Provide details for places in ${currentAreaName}.`;


    try {
      const result = await getPlaceInfo(targetCoords, effectiveQuery);
      setGeneralSummary(result.summary); // result.summary now contains the full model text response
      // searchResults will be empty from getPlaceInfo due to API limitations
      setResponseUrls(result.urls);
    } catch (err: unknown) {
      console.error("API call error:", err);
      if (err instanceof Error) {
        setError(`Error fetching data for ${locationDescription}: ${err.message}`);
      } else {
        setError(`An unexpected error occurred while fetching data for ${locationDescription}.`);
      }
    } finally {
      setLoading(false);
    }
  }, [userLocation, actualUserLocationDetermined, prompt, searchContext, defaultKottayamCoords, filterCategory, filterOptions]);

  const isCurrentLocationSearchDisabled = !actualUserLocationDetermined;

  // These functions are no longer used for structured place selection
  // const handleSelectPlace = (place: Place) => {
  //   setSelectedPlace(place);
  // };

  // const handleBackToResults = () => {
  //   setSelectedPlace(null);
  // };

  return (
    <div className="flex flex-col h-full bg-white text-gray-800">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-600 to-cyan-700 text-white p-4 shadow-md text-center flex-shrink-0">
        <h1 className="text-3xl font-extrabold flex items-center justify-center space-x-2">
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path>
          </svg>
          <span>Location Explorer</span>
        </h1>
        <p className="text-sm mt-1 opacity-90">Powered by Gemini & Google Maps</p>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-6 overflow-y-auto">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {/* Input/Filter Section (always visible as there's no detail view anymore) */}
        <>
          {/* Location Context Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Location:
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-teal-600"
                  name="searchContext"
                  value="kottayam"
                  checked={searchContext === 'kottayam'}
                  onChange={() => setSearchContext('kottayam')}
                  disabled={loading}
                />
                <span className="ml-2 text-gray-900">Kottayam City</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-teal-600"
                  name="searchContext"
                  value="currentLocation"
                  checked={searchContext === 'currentLocation'}
                  onChange={() => setSearchContext('currentLocation')}
                  disabled={loading || isCurrentLocationSearchDisabled}
                />
                <span className="ml-2 text-gray-900">Near My Current Location</span>
              </label>
            </div>
            {isCurrentLocationSearchDisabled && searchContext === 'currentLocation' && (
              <p className="text-red-500 text-xs mt-1">
                (Geolocation unavailable. Please enable permissions or services to use this option.)
              </p>
            )}
          </div>

          {/* Filter Category Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter Category:
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {filterOptions.map((option) => (
                <label key={option.value} className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-teal-600"
                    name="filterCategory"
                    value={option.value}
                    checked={filterCategory === option.value}
                    onChange={() => setFilterCategory(option.value)}
                    disabled={loading}
                  />
                  <span className="ml-2 text-gray-900">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Describe what you are looking for (optional):
            </label>
            <textarea
              id="prompt"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500 shadow-sm resize-y min-h-[80px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'best Italian food', 'museums with art collections', 'banks open late'..."
              disabled={loading}
            ></textarea>
          </div>
        </>


        {loading && (
          <div className="flex justify-center items-center py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-500"></div>
            <p className="ml-4 text-lg text-teal-600">Fetching the latest insights...</p>
          </div>
        )}

        {/* Display General Summary (now the main output) */}
        {!loading && generalSummary && (
          <div className="mb-6">
            <div className="bg-teal-50 p-4 rounded-lg shadow-inner mb-6">
              <h2 className="text-xl font-semibold mb-3 text-teal-800 flex items-center space-x-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm-3.5 9.5a1 1 0 110-2 1 1 0 010 2zM11 11a1 1 0 100-2 1 1 0 000 2zM15.5 11a1 1 0 100-2 1 1 0 000 2zM10 14a4 4 0 01-4-4h2a2 2 0 104 0h2a4 4 0 01-4 4z"></path>
                </svg>
                <span>Gemini's Insights:</span>
              </h2>
              <MarkdownRenderer content={generalSummary} className="text-gray-700 leading-relaxed" />
            </div>

            {/* Previously, searchResults were displayed here as cards. Now, they will always be empty.
            Keeping this check for robustness, but it won't render anything in this configuration. */}
            {searchResults.length === 0 && !generalSummary && !loading && (
              <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-600">
                No detailed results found. Gemini has provided a summary above.
              </div>
            )}
          </div>
        )}

        {/* Place Detail View is no longer supported with Google Maps tool.
        {!loading && selectedPlace && (
          <div className="bg-white p-6 rounded-lg shadow-xl relative animate-fade-in">
            <button
              onClick={handleBackToResults}
              className="absolute top-4 left-4 bg-gray-200 hover:bg-gray-300 rounded-full p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
              aria-label="Back to results"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
            </button>
            <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center mt-8">{selectedPlace.name}</h2>
            <div className="space-y-4">
              <p className="text-gray-700 flex items-center">
                <svg className="w-5 h-5 mr-2 text-teal-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
                <span className="font-semibold">Address:</span> {selectedPlace.address}
              </p>
              <p className="text-gray-700 flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.394 2.08a1 1 0 00-.788 0L.242 8.761A1 1 0 001 10.63l17.758 7.63a1 1 0 001.01-1.706L10.394 2.08zM3.68 9.079L10 3.75l6.32 5.329L10 16.25l-6.32-7.171z"></path></svg>
                <span className="font-semibold">Category:</span> {selectedPlace.category}
              </p>
              <div className="text-gray-700">
                <p className="font-semibold mb-1 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-purple-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17 7H3V5h14v2zm0 4H3V9h14v2zm0 4H3v-2h14v2z"></path></svg>
                  Description:
                </p>
                <p className="ml-7 text-gray-600">{selectedPlace.description}</p>
              </div>
              {selectedPlace.website && (
                <p className="text-gray-700 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M12 2H8a2 2 0 00-2 2v12a2 2 0 002 2h4a2 2 0 002-2V4a2 2 0 00-2-2zm-1 14a1 1 0 11-2 0 1 1 0 012 0zM8 4h4v8H8V4z"></path></svg>
                  <span className="font-semibold">Website:</span>{' '}
                  <a
                    href={selectedPlace.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-teal-600 hover:text-teal-800 hover:underline transition-colors duration-200"
                  >
                    {selectedPlace.website}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}
        */}

        {/* Display grounding URLs (always visible, but clear when no results) */}
        {!loading && responseUrls.length > 0 && (
          <div className="bg-cyan-50 p-4 rounded-lg shadow-inner mt-6">
            <h2 className="text-xl font-semibold mb-3 text-cyan-800 flex items-center space-x-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 6a2 2 0 11-4 0 2 2 0 014 0zM14 12a2 2 0 11-4 0 2 2 0 014 0zM12 18a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0zM6 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <span>Relevant Links from Google Maps:</span>
            </h2>
            <ul className="list-disc list-inside text-gray-700">
              {responseUrls.map((url, index) => (
                <li key={index} className="mb-1">
                  <a
                    href={url.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-700 hover:text-cyan-900 hover:underline transition-colors duration-200"
                  >
                    {url.title || url.uri}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {/* Sticky Footer/Call-to-Action */}
      <footer className="sticky bottom-0 w-full bg-gray-50 p-4 border-t border-gray-200 shadow-lg flex justify-center items-center flex-shrink-0 z-10">
        {/* The "Back to Results" button is no longer needed as there's no detail view */}
        {/* {!selectedPlace ? ( // Only show search button if no place is selected */}
          <button
            onClick={handleSearch}
            disabled={loading || (searchContext === 'currentLocation' && !actualUserLocationDetermined)}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-300
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                </svg>
                <span>Search {searchContext === 'kottayam' ? 'Kottayam' : 'Current Area'}</span>
              </>
            )}
          </button>
        {/* ) : ( // Show back button if a place is selected
          <button
            onClick={handleBackToResults}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center space-x-2"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
            <span>Back to Results</span>
          </button>
        )} */}
      </footer>
    </div>
  );
};

export default App;