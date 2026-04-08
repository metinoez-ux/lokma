'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface MapLocationPickerProps {
 isOpen: boolean;
 onClose: () => void;
 onLocationSelect: (location: SelectedLocation) => void;
 initialLat?: number;
 initialLng?: number;
 kermesLat?: number | null;
 kermesLng?: number | null;
 kermesName?: string;
}

export interface SelectedLocation {
 lat: number;
 lng: number;
 address: string;
 street?: string;
 city?: string;
 postalCode?: string;
 country?: string;
}

export function MapLocationPicker({
 isOpen,
 onClose,
 onLocationSelect,
 initialLat = 51.0, // Mitte Deutschlands
 initialLng = 9.0,
 kermesLat,
 kermesLng,
 kermesName
}: MapLocationPickerProps) {
 const mapRef = useRef<HTMLDivElement>(null);
 const mapInstanceRef = useRef<google.maps.Map | null>(null);
 const markerRef = useRef<google.maps.Marker | null>(null);
 const geocoderRef = useRef<google.maps.Geocoder | null>(null);

 const [isLoading, setIsLoading] = useState(true);
 const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
 const [gpsLoading, setGpsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [isGoogleReady, setIsGoogleReady] = useState(false);

 // Prüfen ob Google Maps bereit ist
 useEffect(() => {
 const checkGoogleMaps = () => {
 if ((window as any).google?.maps?.Map) {
 setIsGoogleReady(true);
 return true;
 }
 return false;
 };

 if (checkGoogleMaps()) return;

 const interval = setInterval(() => {
 if (checkGoogleMaps()) {
 clearInterval(interval);
 }
 }, 100);

 const timeout = setTimeout(() => {
 clearInterval(interval);
 if (!isGoogleReady) {
 setError('Google Maps konnte nicht geladen werden');
 setIsLoading(false);
 }
 }, 10000);

 return () => {
 clearInterval(interval);
 clearTimeout(timeout);
 };
 }, []);

 // Karte initialisieren
 const initMap = useCallback(() => {
 if (!mapRef.current || !isGoogleReady) return;

 try {
 const map = new google.maps.Map(mapRef.current, {
 center: { lat: initialLat, lng: initialLng },
 zoom: 10,
 styles: [
 { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
 { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
 { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
 { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
 { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
 { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1f365d' }] },
 { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
 ],
 disableDefaultUI: true,
 zoomControl: true,
 mapTypeControl: true,
 mapTypeControlOptions: {
  style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
  position: google.maps.ControlPosition.TOP_RIGHT,
  mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.HYBRID],
 },
 streetViewControl: false,
 fullscreenControl: false,
 });

 mapInstanceRef.current = map;
 geocoderRef.current = new google.maps.Geocoder();

 // Klick-Event auf der Karte
 map.addListener('click', (e: google.maps.MapMouseEvent) => {
 if (e.latLng) {
 placeMarker(e.latLng.lat(), e.latLng.lng());
 }
 });

 setIsLoading(false);
 setError(null);
 } catch (err) {
 console.error('Map init error:', err);
 setError('Karte konnte nicht initialisiert werden');
 setIsLoading(false);
 }
 }, [initialLat, initialLng, isGoogleReady]);

 // Karte initialisieren wenn Modal geöffnet und Google bereit ist
 useEffect(() => {
 if (isOpen && isGoogleReady && mapRef.current && !mapInstanceRef.current) {
 // Kurze Verzögerung damit das DOM bereit ist
 const timer = setTimeout(() => {
 initMap();
 }, 100);
 return () => clearTimeout(timer);
 }
 }, [isOpen, isGoogleReady, initMap]);

 // Aufräumen wenn Modal geschlossen wird
 useEffect(() => {
 if (!isOpen) {
 if (markerRef.current) {
 markerRef.current.setMap(null);
 markerRef.current = null;
 }
 mapInstanceRef.current = null;
 setSelectedLocation(null);
 setIsLoading(true);
 setError(null);
 }
 }, [isOpen]);

 // Marker setzen und Adresse abrufen
 const placeMarker = useCallback((lat: number, lng: number) => {
 if (!mapInstanceRef.current || !geocoderRef.current) return;

 // Vorherigen Marker entfernen
 if (markerRef.current) {
 markerRef.current.setMap(null);
 }

 // Yeni marker
 markerRef.current = new google.maps.Marker({
 position: { lat, lng },
 map: mapInstanceRef.current,
 draggable: true,
 animation: google.maps.Animation.DROP,
 icon: {
 path: google.maps.SymbolPath.CIRCLE,
 scale: 12,
 fillColor: '#3B82F6',
 fillOpacity: 1,
 strokeColor: '#fff',
 strokeWeight: 3,
 }
 });

 // Wenn Marker gezogen wird
 markerRef.current.addListener('dragend', () => {
 const pos = markerRef.current?.getPosition();
 if (pos) {
 reverseGeocode(pos.lat(), pos.lng());
 }
 });

 // Koordinatlardan adres al
 reverseGeocode(lat, lng);
 }, []);

 // Reverse Geocoding - Adresse aus Koordinaten
 const reverseGeocode = useCallback((lat: number, lng: number) => {
 if (!geocoderRef.current) return;

 geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
 if (status === 'OK' && results?.[0]) {
 const result = results[0];
 const components = result.address_components || [];

 let street = '';
 let streetNumber = '';
 let city = '';
 let postalCode = '';
 let country = '';

 components.forEach(comp => {
 if (comp.types.includes('route')) street = comp.long_name;
 if (comp.types.includes('street_number')) streetNumber = comp.long_name;
 if (comp.types.includes('locality')) city = comp.long_name;
 if (comp.types.includes('postal_code')) postalCode = comp.long_name;
 if (comp.types.includes('country')) country = comp.long_name;
 });

 setSelectedLocation({
 lat,
 lng,
 address: result.formatted_address,
 street: streetNumber ? `${street} ${streetNumber}` : street,
 city,
 postalCode,
 country
 });
 }
 });
 }, []);

 // Standort per GPS abrufen
 const getGPSLocation = useCallback(() => {
 if (!navigator.geolocation) {
 setError('GPS wird in diesem Browser nicht unterstützt');
 return;
 }

 setGpsLoading(true);
 setError(null);

 navigator.geolocation.getCurrentPosition(
 (position) => {
 const { latitude, longitude } = position.coords;

 // Karte zu diesem Standort verschieben
 if (mapInstanceRef.current) {
 mapInstanceRef.current.setCenter({ lat: latitude, lng: longitude });
 mapInstanceRef.current.setZoom(16);
 }

 // Marker setzen
 placeMarker(latitude, longitude);
 setGpsLoading(false);
 },
 (err) => {
 setGpsLoading(false);
 switch (err.code) {
 case err.PERMISSION_DENIED:
 setError('Standortberechtigung verweigert. Bitte in den Browsereinstellungen erlauben.');
 break;
 case err.POSITION_UNAVAILABLE:
 setError('Standortinformationen nicht verfügbar. Ist GPS aktiviert?');
 break;
 case err.TIMEOUT:
 setError('Zeitüberschreitung bei Standortabfrage');
 break;
 default:
 setError('Standort konnte nicht abgerufen werden');
 }
 },
 { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
 );
 }, [placeMarker]);

 // Standort bestätigen
 const confirmLocation = () => {
 if (selectedLocation) {
 onLocationSelect(selectedLocation);
 onClose();
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={(e) => e.target === e.currentTarget && onClose()}>
 <div className="bg-gray-900 rounded-2xl overflow-hidden w-full max-w-4xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>
 {/* Header */}
 <div className="p-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
 <div>
 <h2 className="text-white font-bold text-lg">📍 Standort wählen</h2>
 <p className="text-gray-400 text-sm">Klicken Sie auf die Karte oder nutzen Sie GPS</p>
 </div>
 <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl w-10 h-10 flex items-center justify-center">×</button>
 </div>

 {/* GPS Button */}
 <div className="p-4 bg-gray-800 flex flex-col sm:flex-row gap-3 flex-shrink-0">
 <button
 onClick={getGPSLocation}
 disabled={gpsLoading || !isGoogleReady}
 className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition disabled:opacity-50"
 >
 {gpsLoading ? (
 <>
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
 Standort wird abgerufen...
 </>
 ) : (
 <>
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 🛰️ Meinen Standort per GPS abrufen
 </>
 )}
 </button>
  <div className="hidden sm:flex text-muted-foreground/80 items-center px-2">oder</div>
  {kermesLat && kermesLng ? (
  <button
  onClick={() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: kermesLat, lng: kermesLng });
      mapInstanceRef.current.setZoom(15);
      placeMarker(kermesLat, kermesLng);
    }
  }}
  disabled={!isGoogleReady}
  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium transition disabled:opacity-50"
  >
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
  </svg>
  Kermes Konumu{kermesName ? ` (${kermesName})` : ''}
  </button>
  ) : (
  <div className="flex-1 text-center text-gray-400 flex items-center justify-center text-sm bg-gray-700/50 rounded-xl py-3 sm:bg-transparent sm:py-0">
  Standort durch Klick auf die Karte wählen
  </div>
  )}
 </div>

 {/* Error */}
 {error && (
 <div className="px-4 py-2 bg-red-600/20 text-red-400 text-sm text-center flex-shrink-0">
 ⚠️ {error}
 </div>
 )}

 {/* Map Container */}
 <div className="relative flex-1" style={{ minHeight: '350px' }}>
 {isLoading && (
 <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
 <div className="text-center">
 <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
 <p className="text-gray-400">Karte wird geladen...</p>
 </div>
 </div>
 )}
 <div
 ref={mapRef}
 style={{ width: '100%', height: '100%', minHeight: '350px' }}
 />
 </div>

 {/* Selected Location Info */}
 {selectedLocation && (
 <div className="p-4 bg-gray-800 border-t border-gray-700 flex-shrink-0">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0 text-green-400">
 ✓
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-white font-medium truncate">{selectedLocation.address}</p>
 <p className="text-gray-400 text-sm">
 {selectedLocation.street && <span>{selectedLocation.street}, </span>}
 {selectedLocation.city && <span>{selectedLocation.city} </span>}
 {selectedLocation.postalCode && <span>{selectedLocation.postalCode}</span>}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Footer */}
 <div className="p-4 border-t border-gray-700 flex gap-3 flex-shrink-0">
 <button
 onClick={onClose}
 className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition"
 >
 Abbrechen
 </button>
 <button
 onClick={confirmLocation}
 disabled={!selectedLocation}
 className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
 >
 ✓ Standort übernehmen
 </button>
 </div>
 </div>
 </div>
 );
}
