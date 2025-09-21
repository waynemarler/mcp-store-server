import { NextRequest } from 'next/server';

// Simple working MCP Weather Server
// This demonstrates a real MCP server that can be registered in the store

export async function GET(request: NextRequest) {
  return Response.json({
    name: 'weather-mcp-server',
    version: '1.0.0',
    description: 'A simple MCP weather server for testing',
    capabilities: ['current-weather', 'forecast', 'weather-alerts']
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Handle MCP protocol messages
  if (body.jsonrpc === '2.0') {
    return handleMCPMessage(body);
  }

  // Handle direct API calls
  return handleDirectAPI(body);
}

async function handleMCPMessage(message: any) {
  try {
    const { method, params, id } = message;

    switch (method) {
      case 'tools/list':
        return Response.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'get_current_weather',
                description: 'Get current weather for a location',
                inputSchema: {
                  type: 'object',
                  properties: {
                    location: { type: 'string', description: 'City name or coordinates' },
                    units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' }
                  },
                  required: ['location']
                }
              },
              {
                name: 'get_forecast',
                description: 'Get weather forecast for a location',
                inputSchema: {
                  type: 'object',
                  properties: {
                    location: { type: 'string', description: 'City name or coordinates' },
                    days: { type: 'number', minimum: 1, maximum: 7, default: 3 },
                    units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' }
                  },
                  required: ['location']
                }
              },
              {
                name: 'get_weather_alerts',
                description: 'Get weather alerts for a location',
                inputSchema: {
                  type: 'object',
                  properties: {
                    location: { type: 'string', description: 'City name or coordinates' }
                  },
                  required: ['location']
                }
              }
            ]
          }
        });

      case 'tools/call':
        const { name, arguments: args } = params;

        switch (name) {
          case 'get_current_weather':
            const currentWeather = await getCurrentWeather(args.location, args.units);
            return Response.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(currentWeather, null, 2)
                  }
                ]
              }
            });

          case 'get_forecast':
            const forecast = await getForecast(args.location, args.days, args.units);
            return Response.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(forecast, null, 2)
                  }
                ]
              }
            });

          case 'get_weather_alerts':
            const alerts = await getWeatherAlerts(args.location);
            return Response.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(alerts, null, 2)
                  }
                ]
              }
            });

          default:
            return Response.json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Unknown tool: ${name}`
              }
            });
        }

      default:
        return Response.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Unknown method: ${method}`
          }
        });
    }
  } catch (error: any) {
    return Response.json({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32000,
        message: error.message
      }
    }, { status: 500 });
  }
}

async function handleDirectAPI(body: any) {
  try {
    const { tool, args } = body;

    switch (tool) {
      case 'get_current_weather':
        const weather = await getCurrentWeather(args.location, args.units);
        return Response.json(weather);

      case 'get_forecast':
        const forecast = await getForecast(args.location, args.days, args.units);
        return Response.json(forecast);

      case 'get_weather_alerts':
        const alerts = await getWeatherAlerts(args.location);
        return Response.json(alerts);

      default:
        return Response.json({ error: 'Unknown tool' }, { status: 400 });
    }
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Mock weather functions (in real implementation, these would call a weather API)
async function getCurrentWeather(location: string, units = 'celsius') {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  const temps = units === 'fahrenheit' ? { temp: 72, feels_like: 75 } : { temp: 22, feels_like: 24 };

  return {
    location,
    current: {
      temperature: temps.temp,
      feels_like: temps.feels_like,
      humidity: 65,
      wind_speed: 12,
      wind_direction: 'NW',
      conditions: 'Partly Cloudy',
      visibility: 10,
      uv_index: 6,
      pressure: 1013.25
    },
    units,
    last_updated: new Date().toISOString()
  };
}

async function getForecast(location: string, days = 3, units = 'celsius') {
  await new Promise(resolve => setTimeout(resolve, 150));

  const forecasts = [];
  const baseTemp = units === 'fahrenheit' ? 70 : 21;

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    forecasts.push({
      date: date.toISOString().split('T')[0],
      high: baseTemp + Math.floor(Math.random() * 10),
      low: baseTemp - Math.floor(Math.random() * 8),
      conditions: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
      precipitation_chance: Math.floor(Math.random() * 100),
      wind_speed: 8 + Math.floor(Math.random() * 10)
    });
  }

  return {
    location,
    forecast: forecasts,
    units,
    generated_at: new Date().toISOString()
  };
}

async function getWeatherAlerts(location: string) {
  await new Promise(resolve => setTimeout(resolve, 80));

  // Mock alerts (randomly return alerts or no alerts)
  const hasAlerts = Math.random() > 0.7;

  if (!hasAlerts) {
    return {
      location,
      alerts: [],
      message: 'No active weather alerts for this location'
    };
  }

  return {
    location,
    alerts: [
      {
        id: 'alert-001',
        title: 'Thunderstorm Watch',
        description: 'Thunderstorms possible this afternoon with heavy rain and strong winds.',
        severity: 'moderate',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        areas: [location]
      }
    ],
    issued_at: new Date().toISOString()
  };
}