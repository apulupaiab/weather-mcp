import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY || '';

interface WeatherResponse {
  current: {
    temp: number;
    weather: Array<{
      main: string;
      description: string;
    }>;
    humidity: number;
    wind_speed: number;
  };
  daily: Array<{
    dt: number;
    temp: {
      day: number;
    };
    weather: Array<{
      main: string;
      description: string;
    }>;
  }>;
}

async function getWeatherData(lat: number, lon: number): Promise<string> {
  try {
    if (!OPENWEATHERMAP_API_KEY) {
      throw new Error('OpenWeatherMap API key is not configured');
    }

    const response = await axios.get<WeatherResponse>(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=metric&lang=zh_cn&appid=${OPENWEATHERMAP_API_KEY}`
    );

    const data = response.data;
    const forecasts = data.daily.slice(0, 3).map(day => {
      const date = new Date(day.dt * 1000).toISOString().split('T')[0];
      return `${date}：${Math.round(day.temp.day)}°C，${day.weather[0].description}`;
    });

    return forecasts.join('\n');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return '错误：API密钥无效或未配置';
      }
      return `获取天气数据失败：${error.response?.data?.message || error.message}`;
    }
    return `获取天气数据失败：${error instanceof Error ? error.message : '未知错误'}`;
  }
}

// 创建MCP服务器实例
const server = new McpServer({
  name: "my-weather",
  version: "1.0.0",
  capabilities: {
    tools: {}
  }
});

// 定义获取天气预报的工具
const getWeatherForecastTool = server.tool(
  "get-forecast",
  {
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  },
  async ({ latitude, longitude }) => {
    try {
      const forecast = await getWeatherData(latitude, longitude);
      return {
        content: [
          {
            type: "text",
            text: `未来三天天气预报：\n${forecast}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `获取天气预报失败：${error instanceof Error ? error.message : '未知错误'}`
          }
        ]
      };
    }
  }
);

// 启动服务器
const transport = new StdioServerTransport();
await server.connect(transport);