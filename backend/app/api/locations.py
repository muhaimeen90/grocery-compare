"""
API routes for store locations and proximity search
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
import math

from ..database import get_db
from ..models import Location, Store
from ..schemas import LocationWithDistance, NearbyLocationsResponse

router = APIRouter(prefix="/api/locations", tags=["locations"])


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on earth (specified in decimal degrees)
    Returns distance in kilometers
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    
    return c * r


@router.get("/nearby", response_model=NearbyLocationsResponse)
async def get_nearby_locations(
    lat: float = Query(..., description="Latitude of search point", ge=-90, le=90),
    lng: float = Query(..., description="Longitude of search point", ge=-180, le=180),
    radius_km: float = Query(50, description="Search radius in kilometers", ge=1, le=500),
    limit: int = Query(20, description="Maximum number of locations to return", ge=1, le=100),
    store_name: Optional[str] = Query(None, description="Filter by store name (Aldi, Coles, IGA, Woolworths)"),
    db: Session = Depends(get_db)
):
    """
    Find nearby store locations based on latitude/longitude coordinates.
    Uses bounding box pre-filtering and Haversine distance calculation for fast queries.
    Returns the closest locations, optionally filtered by store.
    """
    # Calculate bounding box for pre-filtering (1 degree ≈ 111km)
    # Add some buffer to ensure we catch edge cases
    lat_range = (radius_km / 111.0) * 1.2
    lng_range = (radius_km / (111.0 * math.cos(math.radians(lat)))) * 1.2
    
    # Build query with bounding box filter
    query = db.query(Location).join(Store).filter(
        and_(
            Location.latitude.isnot(None),
            Location.longitude.isnot(None),
            Location.latitude.between(lat - lat_range, lat + lat_range),
            Location.longitude.between(lng - lng_range, lng + lng_range)
        )
    )
    
    # Add store filter if specified
    if store_name:
        query = query.filter(Store.name.ilike(store_name))
    
    # Fetch candidates
    locations = query.all()
    
    # Calculate exact distances and filter by radius
    locations_with_distance = []
    for location in locations:
        distance = calculate_haversine_distance(
            lat, lng,
            float(location.latitude), float(location.longitude)
        )
        
        if distance <= radius_km:
            # Convert to dict and add distance
            loc_dict = {
                "id": location.id,
                "store_id": location.store_id,
                "external_store_id": location.external_store_id,
                "name": location.name,
                "address": location.address,
                "suburb": location.suburb,
                "state": location.state,
                "postcode": location.postcode,
                "latitude": float(location.latitude),
                "longitude": float(location.longitude),
                "phone": location.phone,
                "opening_hours": location.opening_hours,
                "is_active": location.is_active,
                "created_at": location.created_at,
                "updated_at": location.updated_at,
                "store": {
                    "id": location.store.id,
                    "name": location.store.name,
                    "created_at": location.store.created_at,
                    "updated_at": location.store.updated_at
                },
                "distance_km": round(distance, 2)
            }
            locations_with_distance.append(loc_dict)
    
    # Sort by distance and limit results
    locations_with_distance.sort(key=lambda x: x["distance_km"])
    locations_with_distance = locations_with_distance[:limit]
    
    return {
        "locations": locations_with_distance,
        "search_point": {"lat": lat, "lng": lng},
        "total": len(locations_with_distance)
    }


@router.get("/nearest-by-store", response_model=List[LocationWithDistance])
async def get_nearest_by_store(
    lat: float = Query(..., description="Latitude of search point", ge=-90, le=90),
    lng: float = Query(..., description="Longitude of search point", ge=-180, le=180),
    radius_km: float = Query(50, description="Search radius in kilometers", ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Get the nearest location for EACH store chain (Aldi, Coles, IGA, Woolworths).
    Returns up to 4 locations, one per store.
    Optimized for the location selection page where we want to show one option per store.
    """
    store_names = ["Aldi", "Coles", "IGA", "Woolworths"]
    nearest_locations = []
    
    for store_name in store_names:
        # Get nearby locations for this store
        result = await get_nearby_locations(
            lat=lat,
            lng=lng,
            radius_km=radius_km,
            limit=1,  # Only get the nearest one
            store_name=store_name,
            db=db
        )
        
        if result["locations"]:
            nearest_locations.append(result["locations"][0])
    
    # Sort by distance
    nearest_locations.sort(key=lambda x: x["distance_km"])
    
    return nearest_locations


@router.get("/{location_id}", response_model=LocationWithDistance)
async def get_location(
    location_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific location by ID
    """
    location = db.query(Location).filter(Location.id == location_id).first()
    
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    return {
        "id": location.id,
        "store_id": location.store_id,
        "external_store_id": location.external_store_id,
        "name": location.name,
        "address": location.address,
        "suburb": location.suburb,
        "state": location.state,
        "postcode": location.postcode,
        "latitude": float(location.latitude) if location.latitude else None,
        "longitude": float(location.longitude) if location.longitude else None,
        "phone": location.phone,
        "opening_hours": location.opening_hours,
        "is_active": location.is_active,
        "created_at": location.created_at,
        "updated_at": location.updated_at,
        "store": {
            "id": location.store.id,
            "name": location.store.name,
            "created_at": location.store.created_at,
            "updated_at": location.store.updated_at
        },
        "distance_km": None
    }
