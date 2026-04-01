import { useState } from 'react';
import { getCityFromCoordinates } from '@/services/geocoding';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  error: string | null;
  loading: boolean;
  geocodingLoading: boolean;
}

interface UseGeolocationReturn extends GeolocationState {
  getCurrentLocation: () => Promise<void>;
  calculateDistance: (lat2: number, lon2: number) => number | null;
}

export const useGeolocation = (): UseGeolocationReturn => {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    city: null,
    state: null,
    error: null,
    loading: false,
    geocodingLoading: false,
  });

  const getCurrentLocation = async (): Promise<void> => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocalização não é suportada neste navegador',
        loading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          setState(prev => ({
            ...prev,
            latitude,
            longitude,
            error: null,
            loading: false,
            geocodingLoading: true,
          }));

          try {
            const locationData = await getCityFromCoordinates(latitude, longitude);
            
            setState(prev => ({
              ...prev,
              city: locationData.city,
              state: locationData.state,
              geocodingLoading: false,
              error: locationData.error || null,
            }));
          } catch (geocodingError) {
            console.error('Erro na geocodificação:', geocodingError);
            setState(prev => ({
              ...prev,
              geocodingLoading: false,
              error: 'Não foi possível determinar sua cidade',
            }));
          }
          
          resolve();
        },
        (error) => {
          let errorMessage = 'Erro ao obter localização';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tempo limite para obter localização';
              break;
          }

          setState(prev => ({
            ...prev,
            error: errorMessage,
            loading: false,
            geocodingLoading: false,
          }));
          
          resolve();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutos
        }
      );
    });
  };

  // Função para calcular distância entre duas coordenadas (fórmula de Haversine)
  const calculateDistance = (lat2: number, lon2: number): number | null => {
    if (!state.latitude || !state.longitude) return null;

    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - state.latitude) * Math.PI / 180;
    const dLon = (lon2 - state.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(state.latitude * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Arredondar para 1 casa decimal
  };

  return {
    ...state,
    getCurrentLocation,
    calculateDistance,
  };
};