'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShoppingBag, Store, AlertTriangle, Car, Bus, MapPin, Clock, ChevronRight } from 'lucide-react';

import { apiClient } from '@/lib/api';
import type { CompareResponse, ProductMatch, TravelInfo, StoreLocationInput } from '@/lib/types';
import { cn, getImageUrl, getOrCreateSessionId, getStoreBadgeClass } from '@/lib/utils';

// Fade-up animation
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' },
  }),
};

function getStoreHeaderClass(store: string): string {
  const storeLower = store.toLowerCase();
  if (storeLower === 'iga') return 'bg-gradient-to-r from-red-600 to-red-500 text-white';
  if (storeLower === 'woolworths') return 'bg-gradient-to-r from-green-600 to-green-500 text-white';
  if (storeLower === 'coles') return 'bg-gradient-to-r from-red-700 to-red-600 text-white';
  if (storeLower === 'aldi') return 'bg-gradient-to-r from-blue-600 to-blue-500 text-white';
  return 'bg-gradient-to-r from-zinc-600 to-zinc-500 text-white';
}

function TravelCostBreakdown({ travel, label }: { travel: TravelInfo; label?: string }) {
  const isPublic = travel.mode === 'transit';
  return (
    <div className="mt-3 bg-zinc-50 border border-zinc-200/80 rounded-xl p-3.5 text-sm">
      <div className="flex items-center gap-2 mb-2 text-zinc-700 font-medium">
        {isPublic ? <Bus className="w-4 h-4 text-primary-600" /> : <Car className="w-4 h-4 text-primary-600" />}
        <span>{label || 'Travel Cost'}</span>
      </div>
      <p className="text-[11px] text-zinc-400 mb-2">{travel.route_description}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white rounded-lg p-2.5 text-center border border-zinc-100">
          <p className="text-zinc-400 text-[11px]">{isPublic ? 'Fare' : 'Fuel/Wear'}</p>
          <p className="font-bold text-zinc-800 mt-0.5">${travel.fuel_or_fare_cost.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg p-2.5 text-center border border-zinc-100">
          <p className="text-zinc-400 text-[11px]">Time Cost</p>
          <p className="font-bold text-zinc-800 mt-0.5">${travel.time_cost.toFixed(2)}</p>
          <p className="text-zinc-400 text-[10px]">{Math.round(travel.duration_min)} min</p>
        </div>
        <div className="bg-primary-50 rounded-lg p-2.5 text-center border border-primary-100">
          <p className="text-primary-600 text-[11px] font-medium">Total Travel</p>
          <p className="font-bold text-primary-700 mt-0.5">${travel.total_cost.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

function ProductMatchCard({ match, showStore }: { match: ProductMatch; showStore?: boolean }) {
  const matched = match.matched_product;

  return (
    <div className={cn(
      "bg-white rounded-xl border border-zinc-200/80 p-4 flex flex-col sm:flex-row gap-3.5 transition-colors",
      !match.is_available && "opacity-60 bg-zinc-50"
    )}>
      <div className="relative w-20 h-20 bg-zinc-50 rounded-xl flex-shrink-0 overflow-hidden">
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
            <h4 className="font-semibold text-zinc-900 text-sm line-clamp-2">
              {matched?.name || match.original_product.name}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
              {matched?.brand && <span>Brand: {matched.brand}</span>}
              {matched?.size && <span>Size: {matched.size}</span>}
            </div>

            {match.mismatch_reason && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md inline-flex">
                <AlertTriangle className="w-3 h-3" />
                <span>{match.mismatch_reason}</span>
              </div>
            )}

            {!match.mismatch_reason && matched && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-primary-700 bg-primary-50 px-2 py-1 rounded-md inline-flex">
                <CheckCircle2 className="w-3 h-3" />
                <span>Exact match</span>
              </div>
            )}

            {!match.is_available && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-red-700 bg-red-50 px-2 py-1 rounded-md inline-flex">
                <AlertCircle className="w-3 h-3" />
                <span>Not available</span>
              </div>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            {matched && match.is_available ? (
              <p className="text-lg font-bold text-zinc-900">{matched.price}</p>
            ) : (
              <p className="text-sm font-medium text-zinc-400">N/A</p>
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
    <div className="min-h-screen bg-[#f8faf7]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href="/cart"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-zinc-400">Location</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white text-[11px] font-bold">2</div>
                <span className="text-xs font-semibold text-zinc-900">Compare Prices</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">Price Comparison</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {hasTravel
                ? `Best deals including ${transportMode === 'public' ? 'public transit' : 'driving'} travel costs`
                : 'See the best deals from a single store or two stores'}
            </p>
          </div>
          {hasTravel && (
            <div className="flex items-center gap-2 bg-white border border-zinc-200 px-3 py-1.5 rounded-xl text-xs text-zinc-600 shadow-sm">
              {transportMode === 'public' ? <Bus className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
              <span className="font-medium">{transportMode === 'public' ? 'Public Transit' : 'Driving'}</span>
            </div>
          )}
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            className="card p-8 flex flex-col items-center gap-3 text-zinc-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="text-sm">Comparing prices across stores{hasTravel ? ' and calculating travel costs' : ''}…</span>
          </motion.div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="card p-6 flex items-start gap-3 border-red-100 bg-red-50/50">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-red-800">{error}</p>
              <Link href="/cart" className="text-xs text-red-600 underline mt-2 inline-block">
                Go back to cart
              </Link>
            </div>
          </div>
        )}

        {/* Comparison Results */}
        {!loading && !error && comparison && (
          <div className="space-y-6">

            {/* Recommendation Banner */}
            {comparison.recommendation && (
              <motion.div
                className="card p-5 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={0}
              >
                <p className="text-base font-bold text-amber-800">{comparison.recommendation}</p>
              </motion.div>
            )}

            {/* Best Single Store Option */}
            <motion.section
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">Best Single Store</h2>
                  <p className="text-xs text-zinc-400">Shop everything at one location</p>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className={cn('px-5 py-4', getStoreHeaderClass(comparison.best_single_store.store))}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{comparison.best_single_store.store}</h3>
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
                          <p className="text-2xl sm:text-3xl font-bold">${comparison.best_single_store.total_with_travel.toFixed(2)}</p>
                          <p className="text-xs opacity-90">Total incl. travel</p>
                          <p className="text-[11px] opacity-75">
                            ${comparison.best_single_store.total.toFixed(2)} products + ${comparison.best_single_store.travel_info?.total_cost.toFixed(2)} travel
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl sm:text-3xl font-bold">${comparison.best_single_store.total.toFixed(2)}</p>
                          <p className="text-xs opacity-90">Total</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {comparison.best_single_store.travel_info && (
                  <div className="px-5 pt-4">
                    <TravelCostBreakdown
                      travel={comparison.best_single_store.travel_info}
                      label={`Travel to ${comparison.best_single_store.store}`}
                    />
                  </div>
                )}

                <div className="p-5 space-y-2.5">
                  {comparison.best_single_store.products.map((match, idx) => (
                    <ProductMatchCard key={idx} match={match} />
                  ))}
                </div>
              </div>
            </motion.section>

            {/* Best Two-Store Option */}
            <motion.section
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">Best Two-Store Combination</h2>
                  <p className="text-xs text-zinc-400">Get the lowest prices by shopping at two stores</p>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">
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
                          <p className="text-2xl sm:text-3xl font-bold">${comparison.best_two_stores.total_with_travel.toFixed(2)}</p>
                          <p className="text-xs opacity-90">Total incl. travel</p>
                          <p className="text-[11px] opacity-75">
                            ${comparison.best_two_stores.total.toFixed(2)} products + ${comparison.best_two_stores.travel_info?.total_cost.toFixed(2)} travel
                          </p>
                          {comparison.best_two_stores.total_with_travel < singleTotal && (
                            <p className="text-[11px] mt-1 bg-white/20 px-2 py-0.5 rounded-md inline-block">
                              Save ${(singleTotal - comparison.best_two_stores.total_with_travel).toFixed(2)} vs single store
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-2xl sm:text-3xl font-bold">${comparison.best_two_stores.total.toFixed(2)}</p>
                          <p className="text-xs opacity-90">Total</p>
                          {comparison.best_two_stores.total < comparison.best_single_store.total && (
                            <p className="text-[11px] mt-1 bg-white/20 px-2 py-0.5 rounded-md inline-block">
                              Save ${(comparison.best_single_store.total - comparison.best_two_stores.total).toFixed(2)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {comparison.best_two_stores.travel_info && (
                  <div className="px-5 pt-4">
                    <TravelCostBreakdown
                      travel={comparison.best_two_stores.travel_info}
                      label={`Travel: ${comparison.best_two_stores.stores.join(' → ')}`}
                    />
                  </div>
                )}

                <div className="p-5 space-y-2.5">
                  {comparison.best_two_stores.products.map((match, idx) => (
                    <ProductMatchCard key={idx} match={match} showStore={true} />
                  ))}
                </div>
              </div>
            </motion.section>

            {/* Summary */}
            <motion.section
              className="card p-5 sm:p-6 bg-gradient-to-br from-primary-50/60 to-emerald-50/60 border-primary-200/60"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={3}
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-zinc-900 mb-3">Summary</h3>
                  <div className="space-y-2 text-sm text-zinc-700">
                    {/* Single store summary */}
                    <div className="flex items-center justify-between bg-white/70 rounded-xl p-3 border border-zinc-200/50">
                      <div>
                        <strong>Single Store ({comparison.best_single_store.store})</strong>
                      </div>
                      <div className="text-right">
                        {hasTravel && comparison.best_single_store.total_with_travel != null ? (
                          <div>
                            <span className="text-zinc-400 line-through mr-2 text-xs">${comparison.best_single_store.total.toFixed(2)}</span>
                            <span className="font-bold text-base">${comparison.best_single_store.total_with_travel.toFixed(2)}</span>
                            <p className="text-[11px] text-zinc-400">incl. ${comparison.best_single_store.travel_info?.total_cost.toFixed(2)} travel</p>
                          </div>
                        ) : (
                          <span className="font-bold text-base">${comparison.best_single_store.total.toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    {/* Two store summary */}
                    <div className="flex items-center justify-between bg-white/70 rounded-xl p-3 border border-zinc-200/50">
                      <div>
                        <strong>Two Stores ({comparison.best_two_stores.stores.join(' + ')})</strong>
                      </div>
                      <div className="text-right">
                        {hasTravel && comparison.best_two_stores.total_with_travel != null ? (
                          <div>
                            <span className="text-zinc-400 line-through mr-2 text-xs">${comparison.best_two_stores.total.toFixed(2)}</span>
                            <span className="font-bold text-base">${comparison.best_two_stores.total_with_travel.toFixed(2)}</span>
                            <p className="text-[11px] text-zinc-400">incl. ${comparison.best_two_stores.travel_info?.total_cost.toFixed(2)} travel</p>
                          </div>
                        ) : (
                          <span className="font-bold text-base">${comparison.best_two_stores.total.toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    {/* Final verdict */}
                    <div className="mt-3 pt-3 border-t border-primary-200/50">
                      {hasTravel ? (
                        singleTotal <= twoTotal ? (
                          <p className="text-primary-700 font-semibold text-sm">
                            ✨ Shopping at {comparison.best_single_store.store} is your best value including travel!
                            {twoTotal > singleTotal && (
                              <span className="block text-xs font-normal mt-1 text-primary-600">
                                You save ${(twoTotal - singleTotal).toFixed(2)} compared to the two-store option
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-primary-700 font-semibold text-sm">
                            💰 Shopping at {comparison.best_two_stores.stores.join(' + ')} saves you ${(singleTotal - twoTotal).toFixed(2)} even with extra travel!
                          </p>
                        )
                      ) : (
                        comparison.best_two_stores.total < comparison.best_single_store.total ? (
                          <p className="text-primary-700 font-semibold text-sm">
                            💰 You save ${(comparison.best_single_store.total - comparison.best_two_stores.total).toFixed(2)} by shopping at two stores!
                          </p>
                        ) : (
                          <p className="text-primary-700 font-semibold text-sm">
                            ✨ Shopping at one store is your best value!
                          </p>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Cost Breakdown Legend */}
            {hasTravel && (
              <motion.section
                className="card p-5 bg-zinc-50/50"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={4}
              >
                <h4 className="font-bold text-zinc-600 mb-3 text-[11px] uppercase tracking-widest">How Travel Costs are Calculated</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-500">
                  {transportMode === 'private' ? (
                    <div>
                      <p className="font-semibold text-zinc-700 mb-1.5 text-xs flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-primary-500" /> Driving Costs
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-[11px]">
                        <li>Fuel & wear: ATO rate of $0.88 per km</li>
                        <li>Time cost: $15.00 per hour (opportunity cost)</li>
                        <li>Based on Google Maps driving distance & duration</li>
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-zinc-700 mb-1.5 text-xs flex items-center gap-1.5">
                        <Bus className="w-3.5 h-3.5 text-primary-500" /> Public Transit Costs
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-[11px]">
                        <li>Fare: Melbourne myki $5.30 per 2-hour window</li>
                        <li>Daily cap: $10.60 if trip exceeds 2 hours</li>
                        <li>Time cost: $15.00 per hour (opportunity cost)</li>
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-zinc-700 mb-1.5 text-xs flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary-500" /> Route Calculation
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-[11px]">
                      <li>Single store: round trip (You → Store → Home)</li>
                      <li>Two stores: chained trip (You → Store A → Store B → Home)</li>
                      <li>Both orderings evaluated; cheapest route selected</li>
                    </ul>
                  </div>
                </div>
              </motion.section>
            )}

            {/* Actions */}
            <motion.div
              className="flex justify-center gap-3"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={5}
            >
              <Link href="/cart" className="btn-secondary">
                Back to Cart
              </Link>
              <Link href="/" className="btn-primary">
                Continue Shopping
              </Link>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
