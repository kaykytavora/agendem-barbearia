import { useState } from "react";
import { getCityFromCoordinates } from "@/services/geocoding";

interface GeolocationState {
  city: string | null;
  error: string | null;
  loading: boolean;
  geocodingLoading: boolean;
}

const estadoInicial: GeolocationState = {
  city: null, error: null, loading: false, geocodingLoading: false,
};

export function useGeolocation() {
  const [state, setState] = useState(estadoInicial);

  async function getCurrentLocation() {
    if (!navigator.geolocation) {
      setState({ ...estadoInicial, error: "Geolocalização não é suportada neste navegador." });
      return;
    }

    setState({ ...estadoInicial, loading: true });
    try {
      const { coords } = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000,
        });
      });
      setState({ ...estadoInicial, geocodingLoading: true });
      const localizacao = await getCityFromCoordinates(coords.latitude, coords.longitude);
      setState({ ...estadoInicial, city: localizacao.city, error: localizacao.error ?? null });
    } catch (erro) {
      const negada = erro && typeof erro === "object" && "code" in erro && erro.code === 1;
      setState({
        ...estadoInicial,
        error: negada ? "Permissão de localização negada." : "Não foi possível obter sua localização.",
      });
    }
  }

  return { ...state, getCurrentLocation };
}
