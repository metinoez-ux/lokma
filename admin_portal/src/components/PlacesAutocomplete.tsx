'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface PlacesAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onPlaceSelect?: (place: PlaceResult) => void;
    placeholder?: string;
    className?: string;
}

interface PlaceResult {
    formattedAddress: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
    lat?: number;
    lng?: number;
}

interface Prediction {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

export function PlacesAutocomplete({
    value,
    onChange,
    onPlaceSelect,
    placeholder = 'Adres ara...',
    className = ''
}: PlacesAutocompleteProps) {
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
    const [isFocused, setIsFocused] = useState(false); // Yalnızca kullanıcı yazdığında arama yap
    const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
    const placesService = useRef<google.maps.places.PlacesService | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

    // Google Maps API hazır mı kontrol et (layout.tsx'de yükleniyor)
    useEffect(() => {
        const checkGoogleMaps = () => {
            if ((window as any).google?.maps?.places) {
                setIsGoogleLoaded(true);
                autocompleteService.current = new google.maps.places.AutocompleteService();
                sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
                // PlacesService için gizli bir element gerekiyor
                const mapDiv = document.createElement('div');
                placesService.current = new google.maps.places.PlacesService(mapDiv);
                return true;
            }
            return false;
        };

        // İlk kontrol
        if (checkGoogleMaps()) return;

        // Henüz yüklenmediyse bekle
        const interval = setInterval(() => {
            if (checkGoogleMaps()) {
                clearInterval(interval);
            }
        }, 100);

        // 10 saniye sonra durdur
        const timeout = setTimeout(() => {
            clearInterval(interval);
            console.warn('Google Maps yüklenemedi');
        }, 10000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);

    // Dışarı tıklama ile kapat
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Adres arama
    const searchPlaces = useCallback((input: string) => {
        if (!autocompleteService.current || input.length < 3) {
            setPredictions([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        autocompleteService.current.getPlacePredictions(
            {
                input,
                sessionToken: sessionTokenRef.current || undefined,
                componentRestrictions: { country: ['de', 'at', 'ch', 'tr', 'nl', 'be', 'fr', 'hu', 'rs', 'bg', 'gr', 'mk', 'al'] },
                types: ['address']
            },
            (results, status) => {
                setIsLoading(false);
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    setPredictions(results);
                    setIsOpen(true);
                } else {
                    setPredictions([]);
                }
            }
        );
    }, []);

    // Debounce ile arama - sadece kullanıcı input'a odaklandığında
    useEffect(() => {
        // Kullanıcı input'a odaklanmadıysa arama yapma (form doldurulurken)
        if (!isFocused || !isGoogleLoaded || value.length < 3) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(() => {
            searchPlaces(value);
        }, 300);

        return () => clearTimeout(timer);
    }, [value, searchPlaces, isGoogleLoaded, isFocused]);

    // Place detaylarını al
    const getPlaceDetails = (placeId: string) => {
        if (!placesService.current) return;

        placesService.current.getDetails(
            {
                placeId,
                fields: ['formatted_address', 'address_components', 'geometry'],
                sessionToken: sessionTokenRef.current || undefined
            },
            (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                    const result = parseAddressComponents(place);
                    onChange(result.street || result.formattedAddress);
                    onPlaceSelect?.(result);
                    setIsOpen(false);
                    setPredictions([]);
                    // Yeni session token oluştur
                    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
                }
            }
        );
    };

    // Adres bileşenlerini ayrıştır
    const parseAddressComponents = (place: google.maps.places.PlaceResult): PlaceResult => {
        const components = place.address_components || [];

        let street = '';
        let streetNumber = '';
        let city = '';
        let postalCode = '';
        let country = '';

        components.forEach(component => {
            const types = component.types;

            if (types.includes('route')) {
                street = component.long_name;
            } else if (types.includes('street_number')) {
                streetNumber = component.long_name;
            } else if (types.includes('locality')) {
                city = component.long_name;
            } else if (types.includes('postal_code')) {
                postalCode = component.long_name;
            } else if (types.includes('country')) {
                country = component.long_name;
            }
        });

        // Almanya formatı: Straße Hausnummer
        const fullStreet = streetNumber ? `${street} ${streetNumber}` : street;

        return {
            formattedAddress: place.formatted_address || '',
            street: fullStreet,
            city,
            postalCode,
            country,
            lat: place.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng()
        };
    };

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => {
                        setIsFocused(true);
                        if (predictions.length > 0) setIsOpen(true);
                    }}
                    onBlur={() => {
                        // Kısa bir gecikme ile kapat (seçim yapabilmek için)
                        setTimeout(() => setIsFocused(false), 200);
                    }}
                    placeholder={placeholder}
                    className={`w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition ${className}`}
                />
                {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                {!isLoading && isGoogleLoaded && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Predictions Dropdown */}
            {isOpen && predictions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg overflow-hidden">
                    {predictions.map((prediction) => (
                        <button
                            key={prediction.place_id}
                            type="button"
                            onClick={() => getPlaceDetails(prediction.place_id)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0"
                        >
                            <div className="text-white text-sm font-medium">
                                {prediction.structured_formatting.main_text}
                            </div>
                            <div className="text-gray-400 text-xs">
                                {prediction.structured_formatting.secondary_text}
                            </div>
                        </button>
                    ))}
                    {/* Google attribution */}
                    <div className="px-3 py-1 bg-gray-900 text-gray-500 text-[10px] flex items-center justify-end gap-1">
                        Powered by
                        <img
                            src="https://developers.google.com/static/maps/documentation/images/google_on_white.png"
                            alt="Google"
                            className="h-3 invert opacity-60"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
