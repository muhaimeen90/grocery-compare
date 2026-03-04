'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShoppingBag, Store, AlertTriangle, Car, Bus, MapPin, Clock } from 'lucide-react';

import { apiClient } from '@/lib/api';
import type { CompareResponse, ProductMatch, TravelInfo, StoreLocationInput } from '@/lib/types';
import { cn, getImageUrl, getOrCreateSessionId, getStoreBadgeClass } from '@/lib/utils';

function getStoreHeaderClass(store: string): string {
  const storeLower = store.toLowerCase();
  if (storeLower === 'iga') return 'bg-red-600 text-white';
  if (storeLower === 'woolworths') return 'bg-green-600 text-white';
  if (storeLower === 'coles') return 'bg-red-700 text-white';
  if (storeLower === 'aldi') return 'bg-blue-600 text-white';
  return 'bg-gray-600 text-white';
}

function TravelCostBreakdown({ travel, label }: { travel: TravelInfo; label?: string }) {
  const isPublic = travel.mode === 'transit';
  return (
    <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-2 text-gray-700 font-medium">
        {isPublic ? <Bus className="w-4 h-4 text-green-600" /> : <Car className="w-4 h-4 text-blue-600" />}
        <span>{label || 'Travel Cost'}</span>
      </div>
      <p className="text-xs text-gray-500 mb-2">{travel.route_description}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white rounded p-2 text-center">
          <p className="text-gray-500">{isPublic ? 'Fare' : 'Fuel/Wear'}</p>
          <p className="font-bold text-gray-800">${travel.fuel_or_fare_cost.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <p className="text-gray-500">Time Cost</p>
          <p className="font-bold text-gray-800">${travel.time_cost.toFixed(2)}</p>
          <p className="text-gray-400">{Math.round(travel.duration_min)} min</p>
        </div>
        <div className="bg-blue-50 rounded p-2 text-center">
          <p className="text-blue-600">Total Travel</p>
          <p className="font-bold text-blue-700">${travel.total_cost.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

function ProductMatchCard({ match, showStore }: { match: ProductMatch; showStore?: boolean }) {
  const matched = match.matched_product;

  return (
    <div className={cn(
      "card p-4 flex flex-col sm:flex-row gap-4",
      !match.is_available && "opacity-60 bg-gray-50"
    )}>
      <div className="relative w-24 h-24 bg-gray-50 rounded flex-shrink-0">
        <Image
          src={getImageUrl(matched?.image_url || match.original_product.image_url)}
          alt={matched?.name || match.original_product.name}
          fill
          className="object-contain p-2"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {showStore && matched && (
              <span className={cn('badge mb-1', getStoreBadgeClass(matched.store))}>{matched.store}</span>
            )}
            <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">
              {matched?.name || match.original_product.name}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              {matched?.brand && <span>Brand: {matched.brand}</span>}
              {matched?.size && <span>Size: {matched.size}</span>}
            </div>

            {match.mismatch_reason && (
              <div className="mt-2 flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded inline-flex">
                <AlertTriangle className="w-3 h-3" />
                <span>{match.mismatch_reason}</span>
              </div>
            )}

            {!match.mismatch_reason && matched && (
              <div className="mt-2 flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded inline-flex">
                <CheckCircle2 className="w-3 h-3" />
                <span>Exact match</span>
              </div>
            )}

            {!match.is_available && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded inline-flex">
                <AlertCircle className="w-3 h-3" />
                <span>Not available</span>
              </div>
            )}
          </div>

          <div className="text-right">
            {matched && match.is_available ? (
              <p className="text-xl font-bold text-gray-900">{matched.price}</p>
            ) : (
              <p className="text-sm font-medium text-gray-500">N/A</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [transportMode, setTransportMode] = useState<string | null>(null);

  const fetchComparison = useCallback(async (sid: string, productIds: number[]) => {
    if (!sid || productIds.length === 0) {
      setError('No items selected for comparison.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Read travel context from localStorage
      let travelParams: {
        userLat: number;
        userLng: number;
        transportMode: 'private' | 'public';
        storeLocations: StoreLocationInput[];
      } | undefined;

      const travelContextStr = localStorage.getItem('travelContext');
      if (travelContextStr) {
        try {
          const tc = JSON.parse(travelContextStr);
          if (tc.userLocation && tc.transportMode && tc.storeLocations?.length > 0) {
            travelParams = {
              userLat: tc.userLocation.lat,
              userLng: tc.userLocation.lng,
              transportMode: tc.transportMode,
              storeLocations: tc.storeLocations,
            };
            setTransportMode(tc.transportMode);
          }
        } catch {
          console.warn('Invalid travel context in localStorage');
        }
      }

      const data = await apiClient.compareCart(productIds, sid, travelParams);
      setComparison(data);
      setError(null);
    } catch (err) {
      console.error('Failed to compare items', err);
      setError('Unable to compare items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sid = localStorage.getItem('sessionId') || getOrCreateSessionId();
    setSessionId(sid);

    const stored = localStorage.getItem('selectedCartItems');
    if (!stored) {
      setError('No items selected for comparison. Please go back and add items to cart.');
      setLoading(false);
      return;
    }

    try {
      const productIds: number[] = JSON.parse(stored);
      if (!Array.isArray(productIds) || productIds.length === 0) {
        setError('No items selected for comparison.');
        setLoading(false);
        return;
      }
      fetchComparison(sid, productIds);
    } catch {
      setError('Invalid selection data.');
      setLoading(false);
    }
  }, [fetchComparison]);

  const hasTravel = comparison?.transport_mode != null;
  const singleTotal = comparison?.best_single_store?.total_with_travel ?? comparison?.best_single_store?.total ?? 0;
  const twoTotal = comparison?.best_two_stores?.total_with_travel ?? comparison?.best_two_stores?.total ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/cart"
          className="rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Price Comparison</h1>
          <p className="text-gray-600">
            {hasTravel
              ? `Best deals including ${transportMode === 'public' ? 'public transit' : 'driving'} travel costs`
              : 'See the best deals from a single store or two stores'}
          </p>
        </div>
        {hasTravel && (
          <div className="ml-auto flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg text-sm text-gray-600">
            {transportMode === 'public' ? <Bus className="w-4 h-4" /> : <Car className="w-4 h-4" />}
            <span>{transportMode === 'public' ? 'Public Transit' : 'Driving'}</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card p-8 flex items-center gap-3 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Comparing prices across stores{hasTravel ? ' and calculating travel costs' : ''}…</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="card p-6 flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            <Link href="/cart" className="text-sm underline mt-2 inline-block">
              Go back to cart
            </Link>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {!loading && !error && comparison && (
        <div className="space-y-8">

          {/* Recommendation Banner */}
          {comparison.recommendation && (
            <div className="card p-5 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200">
              <p className="text-lg font-bold text-amber-800">{comparison.recommendation}</p>
            </div>
          )}

          {/* Best Single Store Option */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Best Single Store</h2>
                <p className="text-gray-600">Shop everything at one location</p>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className={cn('px-6 py-4', getStoreHeaderClass(comparison.best_single_store.store))}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{comparison.best_single_store.store}</h3>
                    <p className="text-sm opacity-90">
                      {comparison.best_single_store.available_count} items available
                      {comparison.best_single_store.missing_count > 0 &&
                        `, ${comparison.best_single_store.missing_count} unavailable`
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    {hasTravel && comparison.best_single_store.total_with_travel != null ? (
                      <>
                        <p className="text-3xl font-bold">${comparison.best_single_store.total_with_travel.toFixed(2)}</p>
                        <p className="text-sm opacity-90">Total incl. travel</p>
                        <p className="text-xs opacity-75">
                          ${comparison.best_single_store.total.toFixed(2)} products + ${comparison.best_single_store.travel_info?.total_cost.toFixed(2)} travel
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-3xl font-bold">${comparison.best_single_store.total.toFixed(2)}</p>
                        <p className="text-sm opacity-90">Total</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Travel cost breakdown */}
              {comparison.best_single_store.travel_info && (
                <div className="px-6 pt-4">
                  <TravelCostBreakdown
                    travel={comparison.best_single_store.travel_info}
                    label={`Travel to ${comparison.best_single_store.store}`}
                  />
                </div>
              )}

              <div className="p-6 space-y-3">
                {comparison.best_single_store.products.map((match, idx) => (
                  <ProductMatchCard key={idx} match={match} />
                ))}
              </div>
            </div>
          </section>

          {/* Best Two-Store Option */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-purple-100 p-2 text-purple-600">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Best Two-Store Combination</h2>
                <p className="text-gray-600">Get the lowest prices by shopping at two stores</p>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">
                      {comparison.best_two_stores.stores.join(' + ')}
                    </h3>
                    <p className="text-sm opacity-90">
                      {comparison.best_two_stores.available_count} items available
                      {comparison.best_two_stores.missing_count > 0 &&
                        `, ${comparison.best_two_stores.missing_count} unavailable`
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    {hasTravel && comparison.best_two_stores.total_with_travel != null ? (
                      <>
                        <p className="text-3xl font-bold">${comparison.best_two_stores.total_with_travel.toFixed(2)}</p>
                        <p className="text-sm opacity-90">Total incl. travel</p>
                        <p className="text-xs opacity-75">
                          ${comparison.best_two_stores.total.toFixed(2)} products + ${comparison.best_two_stores.travel_info?.total_cost.toFixed(2)} travel
                        </p>
                        {comparison.best_two_stores.total_with_travel < singleTotal && (
                          <p className="text-xs mt-1 bg-white/20 px-2 py-0.5 rounded">
                            Save ${(singleTotal - comparison.best_two_stores.total_with_travel).toFixed(2)} vs single store
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-3xl font-bold">${comparison.best_two_stores.total.toFixed(2)}</p>
                        <p className="text-sm opacity-90">Total</p>
                        {comparison.best_two_stores.total < comparison.best_single_store.total && (
                          <p className="text-xs mt-1 bg-white/20 px-2 py-0.5 rounded">
                            Save ${(comparison.best_single_store.total - comparison.best_two_stores.total).toFixed(2)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Travel cost breakdown */}
              {comparison.best_two_stores.travel_info && (
                <div className="px-6 pt-4">
                  <TravelCostBreakdown
                    travel={comparison.best_two_stores.travel_info}
                    label={`Travel: ${comparison.best_two_stores.stores.join(' → ')}`}
                  />
                </div>
              )}

              <div className="p-6 space-y-3">
                {comparison.best_two_stores.products.map((match, idx) => (
                  <ProductMatchCard key={idx} match={match} showStore={true} />
                ))}
              </div>
            </div>
          </section>

          {/* Summary */}
          <section className="card p-6 bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-green-600 p-3 text-white">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Summary</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  {/* Single store summary */}
                  <div className="flex items-center justify-between bg-white/60 rounded-lg p-3">
                    <div>
                      <strong>Single Store ({comparison.best_single_store.store})</strong>
                    </div>
                    <div className="text-right">
                      {hasTravel && comparison.best_single_store.total_with_travel != null ? (
                        <div>
                          <span className="text-gray-500 line-through mr-2">${comparison.best_single_store.total.toFixed(2)}</span>
                          <span className="font-bold text-lg">${comparison.best_single_store.total_with_travel.toFixed(2)}</span>
                          <p className="text-xs text-gray-500">incl. ${comparison.best_single_store.travel_info?.total_cost.toFixed(2)} travel</p>
                        </div>
                      ) : (
                        <span className="font-bold text-lg">${comparison.best_single_store.total.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Two store summary */}
                  <div className="flex items-center justify-between bg-white/60 rounded-lg p-3">
                    <div>
                      <strong>Two Stores ({comparison.best_two_stores.stores.join(' + ')})</strong>
                    </div>
                    <div className="text-right">
                      {hasTravel && comparison.best_two_stores.total_with_travel != null ? (
                        <div>
                          <span className="text-gray-500 line-through mr-2">${comparison.best_two_stores.total.toFixed(2)}</span>
                          <span className="font-bold text-lg">${comparison.best_two_stores.total_with_travel.toFixed(2)}</span>
                          <p className="text-xs text-gray-500">incl. ${comparison.best_two_stores.travel_info?.total_cost.toFixed(2)} travel</p>
                        </div>
                      ) : (
                        <span className="font-bold text-lg">${comparison.best_two_stores.total.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Final verdict */}
                  <div className="mt-3 pt-3 border-t border-green-200">
                    {hasTravel ? (
                      singleTotal <= twoTotal ? (
                        <p className="text-green-700 font-semibold text-base">
                          ✨ Shopping at {comparison.best_single_store.store} is your best value including travel!
                          {twoTotal > singleTotal && (
                            <span className="block text-sm font-normal mt-1">
                              You save ${(twoTotal - singleTotal).toFixed(2)} compared to the two-store option
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-green-700 font-semibold text-base">
                          💰 Shopping at {comparison.best_two_stores.stores.join(' + ')} saves you ${(singleTotal - twoTotal).toFixed(2)} even with extra travel!
                        </p>
                      )
                    ) : (
                      comparison.best_two_stores.total < comparison.best_single_store.total ? (
                        <p className="text-green-700 font-semibold">
                          💰 You save ${(comparison.best_single_store.total - comparison.best_two_stores.total).toFixed(2)} by shopping at two stores!
                        </p>
                      ) : (
                        <p className="text-blue-700 font-semibold">
                          ✨ Shopping at one store is your best value!
                        </p>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Cost Breakdown Legend (when travel is included) */}
          {hasTravel && (
            <section className="card p-5 bg-gray-50 border border-gray-200">
              <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wide">How Travel Costs are Calculated</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                {transportMode === 'private' ? (
                  <div>
                    <p className="font-semibold text-gray-700 mb-1">🚗 Driving Costs</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Fuel & wear: ATO rate of $0.88 per km</li>
                      <li>Time cost: $15.00 per hour (opportunity cost)</li>
                      <li>Based on Google Maps driving distance & duration</li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-gray-700 mb-1">🚌 Public Transit Costs</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Fare: Melbourne myki $5.30 per 2-hour window</li>
                      <li>Daily cap: $10.60 if trip exceeds 2 hours</li>
                      <li>Time cost: $15.00 per hour (opportunity cost)</li>
                    </ul>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-700 mb-1">📐 Route Calculation</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Single store: round trip (You → Store → Home)</li>
                    <li>Two stores: chained trip (You → Store A → Store B → Home)</li>
                    <li>Both orderings evaluated; cheapest route selected</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Link href="/cart" className="btn-secondary">
              Back to Cart
            </Link>
            <Link href="/" className="btn-primary">
              Continue Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
