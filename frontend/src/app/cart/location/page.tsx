'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Navigation, MapPin, Loader2, AlertCircle, Car, Bus, Clock, DollarSign, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { Location, StoreTravelPreview } from '@/lib/types';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] bg-zinc-50 rounded-2xl border border-zinc-200/80">
      <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
    </div>
  ),
});

const MELBOURNE_CENTER = { lat: -37.8136, lng: 144.9631 };

// Fade-in animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' },
  }),
};

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

  useEffect(() => {
    if (userLocation) {
      fetchNearbyStores(userLocation.lat, userLocation.lng);
    }
  }, [userLocation]);

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
    return colors[storeName] || 'bg-zinc-600';
  };

  const getTravelPreview = (storeName: string): StoreTravelPreview | undefined =>
    travelPreviews.find((tp) => tp.store_name === storeName);

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header with step indicator */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button
            onClick={() => router.back()}
            className="text-primary-600 hover:text-primary-700 mb-4 flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            ← Back to Cart
          </button>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white text-xs font-bold">1</div>
              <span className="text-sm font-semibold text-zinc-900">Location & Transport</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 text-xs font-bold">2</div>
              <span className="text-sm font-medium text-zinc-400">Compare Prices</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-2">Location & Transport</h1>
          <p className="text-sm text-zinc-500">
            Set your location and choose how you&apos;ll travel — we&apos;ll factor travel costs into your comparison.
          </p>
        </motion.div>

        {/* Transport Mode Selector */}
        <motion.div
          className="card p-5 sm:p-6 mb-5"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <h2 className="text-base font-bold text-zinc-900 mb-4">How will you travel?</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              onClick={() => setTransportMode('private')}
              className={`flex flex-col items-center gap-2.5 p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${transportMode === 'private'
                  ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-500/20'
                  : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
            >
              <Car className={`w-8 h-8 sm:w-10 sm:h-10 ${transportMode === 'private' ? 'text-primary-600' : 'text-zinc-400'}`} />
              <div className="text-center">
                <p className={`font-bold text-sm sm:text-base ${transportMode === 'private' ? 'text-primary-700' : 'text-zinc-700'}`}>
                  Private (Driving)
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  ATO rate $0.88/km + time cost
                </p>
              </div>
              {transportMode === 'private' && (
                <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            <button
              onClick={() => setTransportMode('public')}
              className={`flex flex-col items-center gap-2.5 p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${transportMode === 'public'
                  ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-500/20'
                  : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
            >
              <Bus className={`w-8 h-8 sm:w-10 sm:h-10 ${transportMode === 'public' ? 'text-primary-600' : 'text-zinc-400'}`} />
              <div className="text-center">
                <p className={`font-bold text-sm sm:text-base ${transportMode === 'public' ? 'text-primary-700' : 'text-zinc-700'}`}>
                  Public Transit
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Myki fare $5.30/2hr + time cost
                </p>
              </div>
              {transportMode === 'public' && (
                <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </motion.div>

        {/* Location Input Methods */}
        <motion.div
          className="card p-5 sm:p-6 mb-5"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <h2 className="text-base font-bold text-zinc-900 mb-4">Set Your Location</h2>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <button
              onClick={handleUseMyLocation}
              disabled={loading}
              className="flex-1 btn-primary h-11 text-sm"
            >
              {loading && locationMethod === 'gps' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Getting Location…
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" />
                  Use My Location
                </>
              )}
            </button>
            <div className="flex items-center justify-center text-zinc-400 text-xs font-medium">
              <span>or</span>
            </div>
            <button
              onClick={() => {
                setLocationMethod('map');
                if (!userLocation) {
                  setUserLocation(MELBOURNE_CENTER);
                }
              }}
              className="flex-1 btn-secondary h-11 text-sm"
            >
              <MapPin className="h-4 w-4" />
              Click Map to Set Location
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm leading-relaxed">{error}</p>
            </div>
          )}

          <div className="mb-3 rounded-xl overflow-hidden border border-zinc-200/80">
            <LocationMap
              userLocation={userLocation}
              nearbyLocations={nearbyStores}
              onLocationSelect={handleMapClick}
              onStoreSelect={() => { }}
              height="450px"
              allowPinning={true}
            />
          </div>

          {userLocation && (
            <p className="text-xs text-zinc-400 text-center flex items-center justify-center gap-1.5">
              <MapPin className="w-3 h-3" />
              Your location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              {locationMethod === 'map' && <span className="text-zinc-300">— Click map to change</span>}
            </p>
          )}
        </motion.div>

        {/* Nearest Stores with Travel Info */}
        {nearbyStores.length > 0 && (
          <motion.div
            className="card p-5 sm:p-6 mb-5"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-bold text-zinc-900">Nearest Stores</h2>
              {(loading || travelLoading) && <Loader2 className="h-4 w-4 animate-spin text-primary-500" />}
            </div>
            <div className="grid gap-3">
              {nearbyStores.map((store) => {
                const preview = getTravelPreview(store.store.name);
                return (
                  <div
                    key={store.id}
                    className="p-4 border border-zinc-200/80 rounded-xl bg-white transition-all hover:bg-zinc-50/80 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`px-2.5 py-0.5 text-white text-[11px] font-bold rounded-md tracking-wide ${getStoreBadgeColor(store.store.name)}`}
                          >
                            {store.store.name.toUpperCase()}
                          </span>
                          {store.distance_km && (
                            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {store.distance_km.toFixed(1)} km
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm text-zinc-900 mb-0.5">{store.name}</h3>
                        <p className="text-xs text-zinc-500">{store.address}</p>
                        <p className="text-xs text-zinc-400">
                          {store.suburb}, {store.state} {store.postcode}
                        </p>
                      </div>

                      {/* Travel info badge */}
                      {preview && (
                        <div className="ml-3 flex flex-col items-end gap-1.5 flex-shrink-0">
                          <div className="flex items-center gap-1 text-xs font-medium text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            <span>~{Math.round(preview.travel_info.duration_min)} min</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg">
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>${preview.travel_info.total_cost.toFixed(2)} round trip</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 text-right">
                            ${preview.travel_info.fuel_or_fare_cost.toFixed(2)} {transportMode === 'private' ? 'fuel/wear' : 'fare'} + ${preview.travel_info.time_cost.toFixed(2)} time
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Continue Button */}
        <motion.div
          className="flex justify-end"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <button
            onClick={handleContinue}
            disabled={!userLocation || nearbyStores.length === 0}
            className="btn-primary h-11 px-6 text-sm"
          >
            Compare Prices with Travel Costs
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export default function LocationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#f8faf7]">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      }
    >
      <LocationPageContent />
    </Suspense>
  );
}
