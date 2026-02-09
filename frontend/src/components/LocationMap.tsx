'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Location } from '@/lib/types';

// Fix for default marker icons in webpack
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

// Melbourne default coordinates
const MELBOURNE_CENTER: [number, number] = [-37.8136, 144.9631];
const DEFAULT_ZOOM = 12;

// Store color scheme
const STORE_COLORS: Record<string, string> = {
  'Aldi': '#0066b2',
  'Coles': '#e31e24',
  'Woolworths': '#2b7b3f',
  'IGA': '#e31837',
};

interface LocationMapProps {
  userLocation?: { lat: number; lng: number } | null;
  nearbyLocations?: Location[];
  onLocationSelect?: (lat: number, lng: number) => void;
  onStoreSelect?: (location: Location) => void;
  height?: string;
  allowPinning?: boolean;
}

export default function LocationMap({
  userLocation,
  nearbyLocations = [],
  onLocationSelect,
  onStoreSelect,
  height = '400px',
  allowPinning = true,
}: LocationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const storeMarkersRef = useRef<L.Marker[]>([]);
  const clickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map centered on Melbourne by default
    const map = L.map(mapContainerRef.current, {
      center: MELBOURNE_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Force map to resize properly
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (clickHandlerRef.current && mapRef.current) {
        mapRef.current.off('click', clickHandlerRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle map click for location pinning
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old click handler
    if (clickHandlerRef.current) {
      mapRef.current.off('click', clickHandlerRef.current);
    }

    // Add new click handler
    if (allowPinning && onLocationSelect) {
      const handler = (e: L.LeafletMouseEvent) => {
        console.log('Map clicked:', e.latlng.lat, e.latlng.lng);
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      };
      
      clickHandlerRef.current = handler;
      mapRef.current.on('click', handler);
    }

    return () => {
      if (clickHandlerRef.current && mapRef.current) {
        mapRef.current.off('click', clickHandlerRef.current);
      }
    };
  }, [allowPinning, onLocationSelect]);

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    // Add new user marker if location is set
    if (userLocation) {
      const userIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="12" r="4" fill="white"/>
          </svg>
        `),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      const marker = L.marker([userLocation.lat, userLocation.lng], { 
        icon: userIcon,
        zIndexOffset: 1000 
      })
        .addTo(mapRef.current)
        .bindPopup('<strong>Your Location</strong>');

      userMarkerRef.current = marker;

      // Center map on user location
      mapRef.current.setView([userLocation.lat, userLocation.lng], 13);
    }
  }, [userLocation]);

  // Update store location markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing store markers
    storeMarkersRef.current.forEach(marker => marker.remove());
    storeMarkersRef.current = [];

    // Add new store markers
    if (nearbyLocations.length > 0) {
      const bounds: [number, number][] = [];

      nearbyLocations.forEach((location) => {
        if (!location.latitude || !location.longitude) return;

        const storeName = location.store.name;
        const color = STORE_COLORS[storeName] || '#666666';

        const storeIcon = L.icon({
          iconUrl: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
              <path d="M16,0 C7.2,0 0,7.2 0,16 C0,28 16,42 16,42 C16,42 32,28 32,16 C32,7.2 24.8,0 16,0 Z" 
                fill="${color}" stroke="white" stroke-width="2"/>
              <text x="16" y="20" text-anchor="middle" font-size="16" font-weight="bold" fill="white">
                ${storeName.charAt(0)}
              </text>
            </svg>
          `),
          iconSize: [32, 42],
          iconAnchor: [16, 42],
          popupAnchor: [0, -42],
        });

        const popupContent = document.createElement('div');
        popupContent.style.minWidth = '200px';
        popupContent.innerHTML = `
          <div>
            <strong style="color: ${color}; font-size: 14px;">${storeName}</strong>
            <p style="margin: 4px 0; font-size: 13px;">${location.name}</p>
            <p style="margin: 2px 0; font-size: 12px; color: #666;">${location.address || ''}</p>
            ${location.distance_km ? `<p style="margin: 2px 0; font-size: 12px; color: #888;">📍 ${location.distance_km.toFixed(1)} km away</p>` : ''}
          </div>
        `;

        if (onStoreSelect) {
          const button = document.createElement('button');
          button.textContent = 'Select This Store';
          button.style.cssText = `
            margin-top: 8px;
            padding: 6px 12px;
            background-color: ${color};
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            width: 100%;
          `;
          button.onclick = () => {
            onStoreSelect(location);
          };
          popupContent.appendChild(button);
        }

        const marker = L.marker([location.latitude, location.longitude], { icon: storeIcon })
          .addTo(mapRef.current!)
          .bindPopup(popupContent);

        storeMarkersRef.current.push(marker);
        bounds.push([location.latitude, location.longitude]);
      });

      // Fit map to show all markers
      if (bounds.length > 0) {
        if (userLocation) {
          bounds.push([userLocation.lat, userLocation.lng]);
        }
        if (bounds.length > 1) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        }
      }
    }
  }, [nearbyLocations, onStoreSelect, userLocation]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        width: '100%', 
        height, 
        borderRadius: '8px', 
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1
      }}
      className="shadow-lg"
    />
  );
}
