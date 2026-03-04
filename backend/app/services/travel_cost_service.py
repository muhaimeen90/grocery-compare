"""
Travel Cost Service — Google Maps Distance Matrix integration with robust cost modelling.

Cost model:
  Private (driving):
    - Fuel/wear: ATO rate ($0.88/km) × total_km
    - Time cost: (duration_min / 60) × VALUE_OF_TIME_PER_HOUR
    - Total = fuel_cost + time_cost

  Public (transit):
    - Fare: Melbourne myki model — $5.30 per 2-hour window, capped at $10.60/day
    - Time cost: (duration_min / 60) × VALUE_OF_TIME_PER_HOUR
    - Total = fare + time_cost

For two-store trips we evaluate both orderings (User→A→B→Home and User→B→A→Home)
and pick the cheaper one.
"""
from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional, Tuple

import googlemaps

from ..config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cost constants (from settings, with sensible defaults)
# ---------------------------------------------------------------------------
ATO_RATE_PER_KM: float = settings.ATO_RATE_PER_KM  # 0.88
MYKI_2HR_FARE: float = settings.MYKI_2HR_FARE  # 5.30
MYKI_DAILY_CAP: float = settings.MYKI_DAILY_CAP  # 10.60
VALUE_OF_TIME_PER_HOUR: float = settings.VALUE_OF_TIME_PER_HOUR  # 15.00


# ---------------------------------------------------------------------------
# Google Maps client singleton
# ---------------------------------------------------------------------------
_gmaps_client: Optional[googlemaps.Client] = None


def _get_gmaps_client() -> Optional[googlemaps.Client]:
    global _gmaps_client
    if _gmaps_client is None and settings.GOOGLE_MAPS_API_KEY:
        try:
            _gmaps_client = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
            logger.info("Google Maps client initialised")
        except Exception as e:
            logger.error("Failed to initialise Google Maps client: %s", e)
    return _gmaps_client


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------
class DistanceEntry:
    """Distance/duration between two points."""
    __slots__ = ("distance_km", "duration_min", "status")

    def __init__(self, distance_km: float, duration_min: float, status: str = "OK"):
        self.distance_km = distance_km
        self.duration_min = duration_min
        self.status = status

    def __repr__(self) -> str:
        return f"DistanceEntry(km={self.distance_km:.1f}, min={self.duration_min:.1f}, status={self.status})"


class TravelCostResult:
    """Computed travel cost breakdown."""
    __slots__ = (
        "distance_km", "duration_min",
        "fuel_or_fare_cost", "time_cost", "total_cost",
        "route_description", "mode",
    )

    def __init__(
        self,
        distance_km: float,
        duration_min: float,
        fuel_or_fare_cost: float,
        time_cost: float,
        total_cost: float,
        route_description: str,
        mode: str,
    ):
        self.distance_km = round(distance_km, 1)
        self.duration_min = round(duration_min, 1)
        self.fuel_or_fare_cost = round(fuel_or_fare_cost, 2)
        self.time_cost = round(time_cost, 2)
        self.total_cost = round(total_cost, 2)
        self.route_description = route_description
        self.mode = mode


# ---------------------------------------------------------------------------
# Haversine fallback (when API unavailable)
# ---------------------------------------------------------------------------
def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


def _estimate_duration_min(distance_km: float, mode: str) -> float:
    """Rough estimate when API is unavailable."""
    if mode == "transit":
        return distance_km / 25 * 60  # ~25 km/h average for transit
    return distance_km / 40 * 60  # ~40 km/h average for urban driving


# ---------------------------------------------------------------------------
# Google Distance Matrix call
# ---------------------------------------------------------------------------
def get_distance_matrix(
    origins: List[Tuple[float, float]],
    destinations: List[Tuple[float, float]],
    mode: str = "driving",
) -> List[List[DistanceEntry]]:
    """
    Call Google Distance Matrix API.
    Returns a 2D list: result[origin_idx][dest_idx] = DistanceEntry

    mode: 'driving' or 'transit'
    origins / destinations: list of (lat, lng) tuples
    """
    client = _get_gmaps_client()

    if client is None:
        # Fallback to haversine estimates
        logger.warning("No Google Maps API key — using haversine fallback")
        return _haversine_fallback_matrix(origins, destinations, mode)

    try:
        # Build location strings
        origin_strs = [f"{lat},{lng}" for lat, lng in origins]
        dest_strs = [f"{lat},{lng}" for lat, lng in destinations]

        gm_mode = "transit" if mode == "transit" else "driving"
        result = client.distance_matrix(
            origins=origin_strs,
            destinations=dest_strs,
            mode=gm_mode,
            units="metric",
        )

        matrix: List[List[DistanceEntry]] = []
        for row in result.get("rows", []):
            row_entries: List[DistanceEntry] = []
            for elem in row.get("elements", []):
                status = elem.get("status", "UNKNOWN")
                if status == "OK":
                    dist_m = elem["distance"]["value"]  # metres
                    dur_s = elem["duration"]["value"]  # seconds
                    row_entries.append(DistanceEntry(dist_m / 1000, dur_s / 60))
                else:
                    row_entries.append(DistanceEntry(0, 0, status=status))
            matrix.append(row_entries)

        return matrix

    except Exception as e:
        logger.error("Distance Matrix API error: %s — falling back to haversine", e)
        return _haversine_fallback_matrix(origins, destinations, mode)


def _haversine_fallback_matrix(
    origins: List[Tuple[float, float]],
    destinations: List[Tuple[float, float]],
    mode: str,
) -> List[List[DistanceEntry]]:
    matrix: List[List[DistanceEntry]] = []
    for o_lat, o_lng in origins:
        row: List[DistanceEntry] = []
        for d_lat, d_lng in destinations:
            # Multiply haversine by 1.3 for road-distance approximation
            straight = _haversine_km(o_lat, o_lng, d_lat, d_lng)
            road_km = straight * 1.3
            dur = _estimate_duration_min(road_km, mode)
            row.append(DistanceEntry(round(road_km, 1), round(dur, 1)))
        matrix.append(row)
    return matrix


# ---------------------------------------------------------------------------
# Cost calculation helpers
# ---------------------------------------------------------------------------
def _calc_private_cost(distance_km: float, duration_min: float) -> Tuple[float, float, float]:
    """Returns (fuel_cost, time_cost, total)."""
    fuel_cost = distance_km * ATO_RATE_PER_KM
    time_cost = (duration_min / 60) * VALUE_OF_TIME_PER_HOUR
    return round(fuel_cost, 2), round(time_cost, 2), round(fuel_cost + time_cost, 2)


def _calc_public_cost(duration_min: float) -> Tuple[float, float, float]:
    """
    Melbourne myki fare model:
    - One 2-hour window = $5.30
    - If total trip exceeds 2 hours, second fare applies → $10.60 (daily cap)
    Returns (fare, time_cost, total).
    """
    if duration_min <= 120:
        fare = MYKI_2HR_FARE
    else:
        fare = MYKI_DAILY_CAP  # two 2-hour fares (capped at daily)
    time_cost = (duration_min / 60) * VALUE_OF_TIME_PER_HOUR
    return round(fare, 2), round(time_cost, 2), round(fare + time_cost, 2)


# ---------------------------------------------------------------------------
# High-level: compute travel costs for the comparison
# ---------------------------------------------------------------------------
def compute_single_store_travel(
    user_coords: Tuple[float, float],
    store_coords: Tuple[float, float],
    store_name: str,
    mode: str = "driving",
) -> TravelCostResult:
    """
    Round-trip: User → Store → User
    For driving: we use the same distance for return.
    For transit: we make a separate call or double the one-way (API is one-direction).
    """
    # Get User→Store and Store→User in one matrix call
    matrix = get_distance_matrix(
        origins=[user_coords, store_coords],
        destinations=[user_coords, store_coords],
        mode=mode,
    )

    # User→Store
    leg_to = matrix[0][1]
    # Store→User
    leg_back = matrix[1][0]

    total_km = leg_to.distance_km + leg_back.distance_km
    total_min = leg_to.duration_min + leg_back.duration_min

    if mode == "transit":
        fare, time_cost, total = _calc_public_cost(total_min)
        route_desc = f"🚌 Round trip to {store_name}: {total_km:.1f} km, ~{total_min:.0f} min"
    else:
        fare, time_cost, total = _calc_private_cost(total_km, total_min)
        route_desc = f"🚗 Round trip to {store_name}: {total_km:.1f} km, ~{total_min:.0f} min"

    return TravelCostResult(
        distance_km=total_km,
        duration_min=total_min,
        fuel_or_fare_cost=fare,
        time_cost=time_cost,
        total_cost=total,
        route_description=route_desc,
        mode=mode,
    )


def compute_two_store_travel(
    user_coords: Tuple[float, float],
    store_a_coords: Tuple[float, float],
    store_b_coords: Tuple[float, float],
    store_a_name: str,
    store_b_name: str,
    mode: str = "driving",
) -> TravelCostResult:
    """
    Chained trip — evaluate both orderings:
      Option 1: User → A → B → User
      Option 2: User → B → A → User
    Pick the cheaper one.
    """
    points = [user_coords, store_a_coords, store_b_coords]
    # Full 3×3 matrix: origins=[User, A, B], destinations=[User, A, B]
    matrix = get_distance_matrix(origins=points, destinations=points, mode=mode)

    # matrix[i][j] = DistanceEntry from point i to point j
    # 0=User, 1=A, 2=B
    def _route_cost(order: List[int]) -> Tuple[float, float, float, float, float]:
        """order is e.g. [0,1,2,0] for User→A→B→User"""
        total_km = 0.0
        total_min = 0.0
        for i in range(len(order) - 1):
            entry = matrix[order[i]][order[i + 1]]
            total_km += entry.distance_km
            total_min += entry.duration_min
        if mode == "transit":
            fare, time_cost, total = _calc_public_cost(total_min)
        else:
            fare, time_cost, total = _calc_private_cost(total_km, total_min)
        return total_km, total_min, fare, time_cost, total

    # Try both orderings
    km1, min1, fare1, tc1, cost1 = _route_cost([0, 1, 2, 0])
    km2, min2, fare2, tc2, cost2 = _route_cost([0, 2, 1, 0])

    if cost1 <= cost2:
        total_km, total_min, fare, time_cost, total = km1, min1, fare1, tc1, cost1
        first, second = store_a_name, store_b_name
    else:
        total_km, total_min, fare, time_cost, total = km2, min2, fare2, tc2, cost2
        first, second = store_b_name, store_a_name

    icon = "🚌" if mode == "transit" else "🚗"
    route_desc = (
        f"{icon} You → {first} → {second} → Home: "
        f"{total_km:.1f} km, ~{total_min:.0f} min"
    )

    return TravelCostResult(
        distance_km=total_km,
        duration_min=total_min,
        fuel_or_fare_cost=fare,
        time_cost=time_cost,
        total_cost=total,
        route_description=route_desc,
        mode=mode,
    )


def compute_all_travel_costs(
    user_coords: Tuple[float, float],
    store_coords_map: Dict[str, Tuple[float, float]],
    mode: str = "driving",
) -> Dict:
    """
    Master function: compute travel costs for every single store and every
    two-store combination. Uses a single Distance Matrix API call for efficiency.

    Parameters:
        user_coords: (lat, lng)
        store_coords_map: {"Aldi": (lat, lng), "Coles": (lat, lng), ...}
        mode: "driving" or "transit"

    Returns dict with:
        single_store: {store_name: TravelCostResult}
        two_store: {(store_a, store_b): TravelCostResult}
    """
    store_names = list(store_coords_map.keys())
    if not store_names:
        return {"single_store": {}, "two_store": {}}

    # Build points list: [User, Store1, Store2, ...]
    points = [user_coords] + [store_coords_map[s] for s in store_names]
    # Index mapping: 0=User, 1=first store, 2=second store, ...
    idx_map = {name: i + 1 for i, name in enumerate(store_names)}

    # Single API call for full NxN matrix
    matrix = get_distance_matrix(origins=points, destinations=points, mode=mode)

    # -- Single store round trips --
    single_store: Dict[str, TravelCostResult] = {}
    for name in store_names:
        si = idx_map[name]
        leg_to = matrix[0][si]      # User → Store
        leg_back = matrix[si][0]    # Store → User

        total_km = leg_to.distance_km + leg_back.distance_km
        total_min = leg_to.duration_min + leg_back.duration_min

        if mode == "transit":
            fare, time_cost, total = _calc_public_cost(total_min)
        else:
            fare, time_cost, total = _calc_private_cost(total_km, total_min)

        icon = "🚌" if mode == "transit" else "🚗"
        single_store[name] = TravelCostResult(
            distance_km=total_km,
            duration_min=total_min,
            fuel_or_fare_cost=fare,
            time_cost=time_cost,
            total_cost=total,
            route_description=f"{icon} Round trip to {name}: {total_km:.1f} km, ~{total_min:.0f} min",
            mode=mode,
        )

    # -- Two store chained trips --
    from itertools import combinations

    two_store: Dict[tuple, TravelCostResult] = {}
    for name_a, name_b in combinations(store_names, 2):
        ai = idx_map[name_a]
        bi = idx_map[name_b]

        def _route_cost(order: List[int]):
            tk, tm = 0.0, 0.0
            for k in range(len(order) - 1):
                entry = matrix[order[k]][order[k + 1]]
                tk += entry.distance_km
                tm += entry.duration_min
            if mode == "transit":
                f, tc, tot = _calc_public_cost(tm)
            else:
                f, tc, tot = _calc_private_cost(tk, tm)
            return tk, tm, f, tc, tot

        km1, min1, fare1, tc1, cost1 = _route_cost([0, ai, bi, 0])
        km2, min2, fare2, tc2, cost2 = _route_cost([0, bi, ai, 0])

        if cost1 <= cost2:
            tk, tm, fare, tc, total = km1, min1, fare1, tc1, cost1
            first, second = name_a, name_b
        else:
            tk, tm, fare, tc, total = km2, min2, fare2, tc2, cost2
            first, second = name_b, name_a

        icon = "🚌" if mode == "transit" else "🚗"
        two_store[(name_a, name_b)] = TravelCostResult(
            distance_km=tk,
            duration_min=tm,
            fuel_or_fare_cost=fare,
            time_cost=tc,
            total_cost=total,
            route_description=f"{icon} You → {first} → {second} → Home: {tk:.1f} km, ~{tm:.0f} min",
            mode=mode,
        )

    return {"single_store": single_store, "two_store": two_store}
