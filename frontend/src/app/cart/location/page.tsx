'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Navigation, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Location } from '@/lib/types';

// Dynamic import for LocationMap to avoid SSR issues with Leaflet
const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] bg-gray-100 rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  ),
});

// Melbourne default coordinates
const MELBOURNE_CENTER = { lat: -37.8136, lng: 144.9631 };

function LocationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || 'default-session';

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyStores, setNearbyStores] = useState<Location[]>([]);
  const [selectedStore, setSelectedStore] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationMethod, setLocationMethod] = useState<'gps' | 'map' | null>(null);

  // Fetch nearby stores when user location changes
  useEffect(() => {
    if (userLocation) {
      fetchNearbyStores(userLocation.lat, userLocation.lng);
    }
  }, [userLocation]);

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

    // Check if we're in a secure context
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      setError('⚠️ Geolocation requires a secure connection (HTTPS). Please access this site via HTTPS or localhost, or click on the map to manually set your location.\n\nUsing Melbourne as default for now.');
      setUserLocation(MELBOURNE_CENTER);
      setLocationMethod('map');
      return;
    }

    setLoading(true);
    setError(null);
    setLocationMethod('gps');

    console.log('Requesting geolocation... Browser should show permission prompt.');
    console.log('Secure context:', window.isSecureContext);
    console.log('Protocol:', window.location.protocol);

    // This will trigger the browser's native permission dialog
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Geolocation success:', position.coords);
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(newLocation);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = '';
        let isPermissionIssue = false;
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '⚠️ Location access was denied. To use your location:\n\n1. Click the location icon in your browser\'s address bar\n2. Allow location access for this site\n3. Click "Use My Location" again\n\nFor now, using Melbourne as default. Click the map to change location.';
            isPermissionIssue = true;
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable. Using Melbourne as default location. Click on the map to set your location.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Using Melbourne as default location. Click on the map to set your location.';
            break;
          default:
            errorMessage = 'Could not get your location. Using Melbourne as default. Click on the map to change it.';
        }
        
        setError(errorMessage);
        setLoading(false);
        
        // Set default to Melbourne if geolocation fails
        console.log('Setting default Melbourne location');
        setUserLocation(MELBOURNE_CENTER);
        setLocationMethod('map');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleMapClick = (lat: number, lng: number) => {
    console.log('Map clicked, setting location:', lat, lng);
    setLocationMethod('map');
    setUserLocation({ lat, lng });
  };

  const handleStoreSelect = (location: Location) => {
    setSelectedStore(location);
  };

  const handleContinue = () => {
    if (!selectedStore) {
      setError('Please select a store to continue');
      return;
    }
    
    // Navigate to confirm page with location and session
    router.push(`/cart/confirm?session=${sessionId}&location=${selectedStore.id}`);
  };

  const getStoreBadgeColor = (storeName: string) => {
    const colors: Record<string, string> = {
      'Aldi': 'bg-blue-600',
      'Coles': 'bg-red-600',
      'Woolworths': 'bg-green-600',
      'IGA': 'bg-red-700',
    };
    return colors[storeName] || 'bg-gray-600';
  };

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Your Location</h1>
          <p className="text-gray-600">
            Choose your location to find the nearest stores and get accurate prices
          </p>
        </div>

        {/* Location Input Methods */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-yellow-800 text-sm whitespace-pre-line">{error}</p>
            </div>
          )}

          {/* Map */}
          <div className="mb-4">
            <LocationMap
              userLocation={userLocation}
              nearbyLocations={nearbyStores}
              onLocationSelect={handleMapClick}
              onStoreSelect={handleStoreSelect}
              height="500px"
              allowPinning={true}
            />
          </div>

          {userLocation && (
            <p className="text-sm text-gray-600 text-center">
              📍 Selected location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              {locationMethod === 'map' && ' (Click map to change)'}
            </p>
          )}
        </div>

        {/* Nearby Stores List */}
        {nearbyStores.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Nearest Stores {loading && <Loader2 className="inline h-5 w-5 animate-spin ml-2" />}
            </h2>
            <div className="grid gap-4">
              {nearbyStores.map((store) => (
                <div
                  key={store.id}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedStore?.id === store.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleStoreSelect(store)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 text-white text-sm font-bold rounded ${getStoreBadgeColor(store.store.name)}`}>
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
                      {store.phone && (
                        <p className="text-sm text-gray-500 mt-1">📞 {store.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center">
                      {selectedStore?.id === store.id ? (
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            disabled={!selectedStore}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold flex items-center gap-2"
          >
            Continue to Price Comparison
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
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <LocationPageContent />
    </Suspense>
  );
}
