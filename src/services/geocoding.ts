interface GeocodingResult {
  city: string | null;
  state: string | null;
  country: string | null;
  error?: string;
}

interface NominatimResponse {
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

interface BigDataCloudResponse {
  city: string;
  principalSubdivision: string;
  countryName: string;
}

// Nominatim (OpenStreetMap) - Totalmente gratuito
export const nominatimReverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<GeocodingResult> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1&accept-language=pt-BR,pt`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Fiden-Agency-SaaS/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data: NominatimResponse = await response.json();

    if (!data.address) {
      return {
        city: null,
        state: null,
        country: null,
        error: 'Nenhum endereço encontrado'
      };
    }

    const address = data.address;
    const city = address.city || 
                 address.town || 
                 address.village || 
                 address.municipality || 
                 address.county || 
                 null;

    return {
      city,
      state: address.state || null,
      country: address.country || null
    };
  } catch (error) {
    console.error('Erro no Nominatim:', error);
    return {
      city: null,
      state: null,
      country: null,
      error: error instanceof Error ? error.message : 'Erro no serviço de localização'
    };
  }
};

// BigDataCloud - Gratuito até 10k requests/mês
export const bigDataCloudReverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<GeocodingResult> => {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data: BigDataCloudResponse = await response.json();

    return {
      city: data.city || null,
      state: data.principalSubdivision || null,
      country: data.countryName || null
    };
  } catch (error) {
    console.error('Erro no BigDataCloud:', error);
    return {
      city: null,
      state: null,
      country: null,
      error: error instanceof Error ? error.message : 'Erro no serviço de localização'
    };
  }
};

// ViaCEP - Para casos específicos do Brasil, funciona com coordenadas aproximadas
export const viaCepReverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<GeocodingResult> => {
  try {
    // Mapeamento simples para principais cidades brasileiras baseado em coordenadas aproximadas
    const brazilianCities = [
      { name: 'São Paulo', state: 'SP', lat: -23.5505, lng: -46.6333, radius: 0.5 },
      { name: 'Rio de Janeiro', state: 'RJ', lat: -22.9068, lng: -43.1729, radius: 0.3 },
      { name: 'Belo Horizonte', state: 'MG', lat: -19.9167, lng: -43.9345, radius: 0.3 },
      { name: 'Brasília', state: 'DF', lat: -15.8267, lng: -47.9218, radius: 0.3 },
      { name: 'Salvador', state: 'BA', lat: -12.9714, lng: -38.5014, radius: 0.3 },
      { name: 'Fortaleza', state: 'CE', lat: -3.7319, lng: -38.5267, radius: 0.3 },
      { name: 'Porto Alegre', state: 'RS', lat: -30.0346, lng: -51.2177, radius: 0.3 },
      { name: 'Recife', state: 'PE', lat: -8.0476, lng: -34.8770, radius: 0.3 },
      { name: 'Curitiba', state: 'PR', lat: -25.4284, lng: -49.2733, radius: 0.3 },
      { name: 'Manaus', state: 'AM', lat: -3.1190, lng: -60.0217, radius: 0.3 }
    ];

    const nearbyCity = brazilianCities.find(city => {
      const distance = Math.sqrt(
        Math.pow(latitude - city.lat, 2) + Math.pow(longitude - city.lng, 2)
      );
      return distance <= city.radius;
    });

    if (nearbyCity) {
      return {
        city: nearbyCity.name,
        state: nearbyCity.state,
        country: 'Brasil'
      };
    }

    return {
      city: null,
      state: null,
      country: null,
      error: 'Cidade não identificada no mapeamento brasileiro'
    };
  } catch (error) {
    console.error('Erro no mapeamento brasileiro:', error);
    return {
      city: null,
      state: null,
      country: null,
      error: 'Erro no mapeamento de cidades brasileiras'
    };
  }
};

export const getCityFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<GeocodingResult> => {
  // Tentar BigDataCloud primeiro (mais rápido)
  let result = await bigDataCloudReverseGeocode(latitude, longitude);
  
  if (result.error || !result.city) {
    result = await nominatimReverseGeocode(latitude, longitude);
  }

  // Se ainda não funcionou e estamos no Brasil, tentar mapeamento local
  if ((result.error || !result.city) && latitude > -35 && latitude < 5 && longitude > -75 && longitude < -30) {
    result = await viaCepReverseGeocode(latitude, longitude);
  }
  
  return result;
};