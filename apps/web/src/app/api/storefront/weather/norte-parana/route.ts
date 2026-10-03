import { NextResponse } from "next/server";

const WEATHER_URL = new URL("https://api.open-meteo.com/v1/forecast");
WEATHER_URL.search = new URLSearchParams({
  latitude: "-23.3045",
  longitude: "-51.1696",
  current:
    "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,is_day",
  daily: "sunrise,sunset",
  timezone: "America/Sao_Paulo",
  forecast_days: "1",
}).toString();

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    rain?: number;
    weather_code?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
    is_day?: number;
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
};

function weatherDescription(code: number) {
  if (code === 0) return "céu limpo";
  if (code === 1) return "predominantemente aberto";
  if (code === 2) return "parcialmente nublado";
  if (code === 3) return "nublado";
  if (code === 45 || code === 48) return "neblina";
  if (code >= 51 && code <= 57) return "garoa";
  if (code >= 61 && code <= 67) return "chuva";
  if (code >= 71 && code <= 77) return "precipitação de neve";
  if (code >= 80 && code <= 82) return "pancadas de chuva";
  if (code >= 85 && code <= 86) return "pancadas de neve";
  if (code >= 95) return "trovoadas";
  return "condição variável";
}

export async function GET() {
  try {
    const response = await fetch(WEATHER_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 600 },
    });
    if (!response.ok) throw new Error("weather lookup failed");

    const data = (await response.json()) as OpenMeteoResponse;
    const current = data.current;
    if (
      !current ||
      typeof current.temperature_2m !== "number" ||
      typeof current.weather_code !== "number"
    ) {
      throw new Error("weather response incomplete");
    }

    return NextResponse.json({
      location: "Norte do Paraná · referência Londrina",
      observedAt: current.time ?? null,
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature ?? null,
      humidity: current.relative_humidity_2m ?? null,
      precipitation: current.precipitation ?? 0,
      rain: current.rain ?? 0,
      cloudCover: current.cloud_cover ?? null,
      windSpeed: current.wind_speed_10m ?? null,
      weatherCode: current.weather_code,
      condition: weatherDescription(current.weather_code),
      isDay: current.is_day ?? null,
      sunrise: data.daily?.sunrise?.[0] ?? null,
      sunset: data.daily?.sunset?.[0] ?? null,
      source: "Open-Meteo",
    });
  } catch {
    return NextResponse.json(
      { message: "Condições meteorológicas temporariamente indisponíveis." },
      { status: 502 },
    );
  }
}
