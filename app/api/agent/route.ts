import { NextRequest, NextResponse } from "next/server";
import { Parser } from "expr-eval";

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...(init || {}), headers: { "User-Agent": "agentic-7a98c897", ...(init?.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

async function toolWikipedia(query: string) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=1&origin=*&search=${encodeURIComponent(query)}`;
  const data = await fetchJson(searchUrl);
  const [_, titles, descriptions, urls] = data as [string, string[], string[], string[]];
  if (!titles?.length || !titles[0]) return `No Wikipedia results for "${query}".`;
  const title = String(titles[0]);
  const description = descriptions?.[0];
  const url = urls?.[0];
  if (description && url) return `${title}: ${description}\n\n${url}`;
  const pageTitle = encodeURIComponent(title);
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
  const summary = await fetchJson(summaryUrl).catch(() => null);
  const extract = summary?.extract || description || "(no summary)";
  const pageUrl = summary?.content_urls?.desktop?.page || url || `https://en.wikipedia.org/wiki/${pageTitle}`;
  return `${title}: ${extract}\n\n${pageUrl}`;
}

async function toolWeather(place: string) {
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`;
  const geo = await fetchJson(geoUrl);
  const loc = geo?.results?.[0];
  if (!loc) return `Couldn't find location for "${place}".`;
  const { latitude, longitude, name, country_code } = loc;
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`;
  const fx = await fetchJson(forecastUrl);
  const c = fx?.current;
  if (!c) return `No weather data available for ${name}.`;
  const parts = [
    `Weather for ${name}${country_code ? ", " + country_code : ""}:`,
    `Temperature: ${c.temperature_2m}?C (feels ${c.apparent_temperature}?C)`,
    `Humidity: ${c.relative_humidity_2m}%`,
    `Wind: ${c.wind_speed_10m} m/s`,
  ];
  return parts.join("\n");
}

function toolCalc(expr: string) {
  const parser = new Parser();
  try {
    const value = parser.evaluate(expr);
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return JSON.stringify(value);
  } catch (e: any) {
    return `Calculation error: ${e?.message ?? e}`;
  }
}

function detectIntent(input: string): { kind: "weather" | "wiki" | "calc" | "other"; arg?: string } {
  const text = input.trim();
  const mWeather = text.match(/^(?:what(?:'s| is) the )?weather in (.+)$/i) || text.match(/^weather(?: for| in)? (.+)$/i);
  if (mWeather) return { kind: "weather", arg: mWeather[1] };

  const mWiki = text.match(/^(?:wiki|wikipedia) (.+)$/i) || text.match(/^(?:who|what) is (.+)$/i) || text.match(/^tell me about (.+)$/i);
  if (mWiki) return { kind: "wiki", arg: mWiki[1] };

  const mCalc = text.match(/^(?:calc(?:ulate)?\s*:?\s*)?([-+/*%^().\d\s]+)$/i);
  if (mCalc) return { kind: "calc", arg: mCalc[1] };

  // Heuristic: if it's a math-like string, treat as calc
  if (/^[-+/*%^().\d\s]+$/.test(text)) return { kind: "calc", arg: text };

  return { kind: "other" };
}

async function openAiFallback(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a concise helpful assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.toString?.();
    return text || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { input } = await req.json().catch(() => ({ input: "" }));
  const text: string = (input || "").toString();
  if (!text.trim()) return NextResponse.json({ reply: "Please type something." });

  const intent = detectIntent(text);
  try {
    if (intent.kind === "weather" && intent.arg) {
      const out = await toolWeather(intent.arg);
      return NextResponse.json({ reply: out });
    }
    if (intent.kind === "wiki" && intent.arg) {
      const out = await toolWikipedia(intent.arg);
      return NextResponse.json({ reply: out });
    }
    if (intent.kind === "calc" && intent.arg) {
      const out = toolCalc(intent.arg);
      return NextResponse.json({ reply: out });
    }

    const maybe = await openAiFallback(text);
    if (maybe) return NextResponse.json({ reply: maybe });

    const help = [
      "I can help with:",
      "- weather in <city>",
      "- wiki <topic>",
      "- math expressions (e.g., 3*(5+7))"
    ].join("\n");
    return NextResponse.json({ reply: `I didn't recognize that.\n\n${help}` });
  } catch (e: any) {
    return NextResponse.json({ reply: `Error: ${e?.message ?? e}` });
  }
}
