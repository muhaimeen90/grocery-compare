'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Navigation, MapPin, Loader2, AlertCircle, Car, Bus, Clock, DollarSign } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { Location, StoreTravelPreview } from '@/lib/types';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] bg-gray-100 rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  ),
});

const MELBOURNE_CENTER = { lat: -37.8136, lng: 144.9631 };

function LocationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || 'default-session';

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyStores, setNearbyStores] = useState<Location[]>([]);
  const [transportMode, setTransportMode] = useState<'private' | 'public'>('private');
  const [loading, setLoading] = useState(false);
  const [travelLoading, setTravelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationMethod, setLocationMethod] = useState<'gps' | 'map' | null>(null);
  const [travelPreviews, setTravelPreviews] = useState<StoreTravelPreview[]>([]);

  // Fetch nearby stores when user location changes
  useEffect(() => {
    if (userLocation) {
      fetchNearbyStores(userLocation.lat, userLocation.lng);
    }
  }, [userLocation]);

  // Fetch travel estimates when stores or transport mode changes
  const fetchTravelPreviews = useCallback(async () => {
    if (!userLocation || nearbyStores.length === 0) return;

    setTravelLoading(true);
    try {
      const storeLocations = nearbyStores
        .filter((s) => s.latitude && s.longitude)
        .map((s) => ({
          store_name: s.store.name,
          lat: s.latitude!,
          lng: s.longitude!,
        }));

      if (storeLocations.length === 0) return;

      const response = await apiClient.getTravelMatrix(
        userLocation.lat,
        userLocation.lng,
        transportMode,
        storeLocations
      );
      setTravelPreviews(response.stores);
    } catch (err) {
      console.error('Error fetching travel matrix:', err);
    } finally {
      setTravelLoading(false);
    }
  }, [userLocation, nearbyStores, transportMode]);

  useEffect(() => {
    fetchTravelPreviews();
  }, [fetchTravelPreviews]);

  const fetchNearbyStores = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getNearestByStore(lat, lng, 50);
      setNearbyStores(response);

      if (response.length === 0) {
        setError('No stores found within 50km of your location. Please try a different location in Australia.');
      }
    } catch (err) {
      console.error('Error fetching nearby stores:', err);
      setError('Failed to fetch nearby stores. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      setError('⚠️ Geolocation requires HTTPS. Using Melbourne as default. Click the map to change.');
      setUserLocation(MELBOURNE_CENTER);
      setLocationMethod('map');
      return;
    }

    setLoading(true);
    setError(null);
    setLocationMethod('gps');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
        setError(null);
      },
      (geoError) => {
        let errorMessage = '';
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            errorMessage = '⚠️ Location access denied. Using Melbourne as default. Click the map to change.';
            break;
          case geoError.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable. Using Melbourne as default.';
            break;
          case geoError.TIMEOUT:
            errorMessage = 'Location request timed out. Using Melbourne as default.';
            break;
          default:
            errorMessage = 'Could not get your location. Using Melbourne as default.';
        }
        setError(errorMessage);
        setLoading(false);
        setUserLocation(MELBOURNE_CENTER);
        setLocationMethod('map');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMapClick = (lat: number, lng: number) => {
    setLocationMethod('map');
    setUserLocation({ lat, lng });
  };

  const handleContinue = () => {
    if (!userLocation) {
      setError('Please set your location first');
      return;
    }
    if (nearbyStores.length === 0) {
      setError('No nearby stores found. Please try a different location.');
      return;
    }

    // Save travel context for the confirm page
    const storeLocations = nearbyStores
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({
        store_name: s.store.name,
        lat: s.latitude!,
        lng: s.longitude!,
      }));

    localStorage.setItem(
      'travelContext',
      JSON.stringify({
        userLocation,
        transportMode,
        storeLocations,
      })
    );

    router.push(`/cart/confirm?session=${sessionId}`);
  };

  const getStoreBadgeColor = (storeName: string) => {
    const colors: Record<string, string> = {
      Aldi: 'bg-blue-600',
      Coles: 'bg-red-600',
      Woolworths: 'bg-green-600',
      IGA: 'bg-red-700',
    };
    return colors[storeName] || 'bg-gray-600';
  };

  const getTravelPreview = (storeName: string): StoreTravelPreview | undefined =>
    travelPreviews.find((tp) => tp.store_name === storeName);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            ← Back to Cart
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Location & Transport</h1>
          <p className="text-gray-600">
            Set your location and choose how you'll travel — we'll factor travel costs into your comparison
          </p>
        </div>

        {/* Transport Mode Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">How will you travel?</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setTransportMode('private')}
              className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
                transportMode === 'private'
                  ? 'border-blue-600 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Car className={`w-10 h-10 ${transportMode === 'private' ? 'text-blue-600' : 'text-gray-400'}`} />
              <div className="text-center">
                <p className={`font-bold text-lg ${transportMode === 'private' ? 'text-blue-600' : 'text-gray-700'}`}>
                  Private (Driving)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ATO rate $0.88/km + time cost
                </p>
              </div>
              {transportMode === 'private' && (
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            <button
              onClick={() => setTransportMode('public')}
              className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
                transportMode === 'public'
                  ? 'border-green-600 bg-green-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Bus className={`w-10 h-10 ${transportMode === 'public' ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="text-center">
                <p className={`font-bold text-lg ${transportMode === 'public' ? 'text-green-600' : 'text-gray-700'}`}>
                  Public Transit
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Myki fare $5.30/2hr + time cost
                </p>
              </div>
              {transportMode === 'public' && (
                <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Location Input Methods */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Set Your Location</h2>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <button
              onClick={handleUseMyLocation}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading && locationMethod === 'gps' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Getting Location...
                </>
              ) : (
                <>
                  <Navigation className="h-5 w-5" />
                  Use My Location
                </>
              )}
            </button>
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <span className="px-4">or</span>
            </div>
            <button
              onClick={() => {
                setLocationMethod('map');
                if (!userLocation) {
                  setUserLocation(MELBOURNE_CENTER);
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <MapPin className="h-5 w-5" />
              Click Map to Set Location
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-yellow-800 text-sm whitespace-pre-line">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <LocationMap
              userLocation={userLocation}
              nearbyLocations={nearbyStores}
              onLocationSelect={handleMapClick}
              onStoreSelect={() => {}}
              height="500px"
              allowPinning={true}
            />
          </div>

          {userLocation && (
            <p className="text-sm text-gray-600 text-center">
              📍 Your location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              {locationMethod === 'map' && ' (Click map to change)'}
            </p>
          )}
        </div>

        {/* Nearest Stores with Travel Info */}
        {nearbyStores.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Nearest Stores
              {(loading || travelLoading) && <Loader2 className="inline h-5 w-5 animate-spin ml-2" />}
            </h2>
            <div className="grid gap-4">
              {nearbyStores.map((store) => {
                const preview = getTravelPreview(store.store.name);
                return (
                  <div
                    key={store.id}
                    className="p-4 border-2 border-gray-200 rounded-lg bg-white transition-all hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-3 py-1 text-white text-sm font-bold rounded ${getStoreBadgeColor(store.store.name)}`}
                          >
                            {store.store.name.toUpperCase()}
                          </span>
                          {store.distance_km && (
                            <span className="text-sm text-gray-600">
                              📍 {store.distance_km.toFixed(1)} km away
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{store.name}</h3>
                        <p className="text-sm text-gray-600 mb-1">{store.address}</p>
                        <p className="text-sm text-gray-500">
                          {store.suburb}, {store.state} {store.postcode}
                        </p>
                      </div>

                      {/* Travel info badge */}
                      {preview && (
                        <div className="ml-4 flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1 text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg">
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span>~{Math.round(preview.travel_info.duration_min)} min</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                            <DollarSign className="w-4 h-4" />
                            <span>${preview.travel_info.total_cost.toFixed(2)} round trip</span>
                          </div>
                          <p className="text-xs text-gray-400 text-right">
                            ${preview.travel_info.fuel_or_fare_cost.toFixed(2)} {transportMode === 'private' ? 'fuel/wear' : 'fare'} + ${preview.travel_info.time_cost.toFixed(2)} time
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!userLocation || nearbyStores.length === 0}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold flex items-center gap-2"
          >
            Compare Prices with Travel Costs
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LocationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <LocationPageContent />
    </Suspense>
  );
}
