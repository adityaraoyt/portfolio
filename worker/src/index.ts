export interface Env {
  GEMINI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGINS: string;
  CHAT_MODEL: string;
  EMBEDDING_MODEL: string;
  MATCH_COUNT: string;
  RATE_LIMIT: string;
}

interface ChatRequest {
  message: string;
}

interface DocumentMatch {
  id: number;
  content: string;
  metadata: {
    section?: string;
    source?: string;
    url_anchor?: string;
  };
  similarity: number;
}

interface ChatResponse {
  answer: string;
  sources: Array<{
    section: string;
    source: string;
    url_anchor: string;
  }>;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim());
  const isAllowed = origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

async function checkRateLimit(request: Request, env: Env): Promise<boolean> {
  const limit = Number(env.RATE_LIMIT || "20");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const cacheKey = new Request(`https://rate-limit.internal/${ip}`);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;

  if (cached) {
    const data = (await cached.json()) as { count: number; windowStart: number };
    if (now - data.windowStart < windowMs) {
      if (data.count >= limit) return false;
      data.count += 1;
    } else {
      data.count = 1;
      data.windowStart = now;
    }
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(data), {
        headers: { "Cache-Control": `max-age=${Math.ceil(windowMs / 1000)}` },
      }),
    );
    return true;
  }

  await cache.put(
    cacheKey,
    new Response(JSON.stringify({ count: 1, windowStart: now }), {
      headers: { "Cache-Control": `max-age=${Math.ceil(windowMs / 1000)}` },
    }),
  );
  return true;
}

async function embedQuery(text: string, env: Env): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        model: `models/${env.EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    embedding?: { values?: number[] };
  };
  const values = data.embedding?.values;
  if (!values?.length) throw new Error("Empty embedding response");
  return values;
}

async function retrieveDocuments(embedding: number[], env: Env): Promise<DocumentMatch[]> {
  const matchCount = Number(env.MATCH_COUNT || "5");
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/match_documents`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_count: matchCount,
    }),
  });

  if (!response.ok) {
    throw new Error(`Retrieval failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as DocumentMatch[];
}

async function generateAnswer(question: string, matches: DocumentMatch[], env: Env): Promise<string> {
  const context = matches.map((match) => match.content).join("\n\n---\n\n");
  const prompt = `You are Aditya's portfolio assistant. Answer ONLY from the provided context.
If the answer is not in the context, say you don't know and suggest contacting avrao1890@gmail.com.
Keep answers concise, friendly, and professional.

Context:
---
${context}
---

Question: ${question}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.CHAT_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Generation failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "PROHIBITED_CONTENT") {
    return "I can't answer that request, but I can help with Aditya's experience, skills, education, or projects.";
  }
  const answer = candidate?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!answer) {
    throw new Error(
      `No generated text. finishReason=${candidate?.finishReason || "unknown"}`
    );
  }
  return answer;
}

function buildSources(matches: DocumentMatch[]): ChatResponse["sources"] {
  const seen = new Set<string>();
  const sources: ChatResponse["sources"] = [];

  for (const match of matches) {
    const section = match.metadata?.section || "Portfolio";
    const source = match.metadata?.source || "portfolio.md";
    const url_anchor = match.metadata?.url_anchor || "#top";
    const key = `${section}:${url_anchor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ section, source, url_anchor });
  }

  return sources;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || !url.pathname.endsWith("/chat")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...JSON_HEADERS, ...cors },
      });
    }

    try {
      const withinLimit = await checkRateLimit(request, env);
      if (!withinLimit) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again in an hour.",
          }),
          { status: 429, headers: { ...JSON_HEADERS, ...cors } },
        );
      }

      const body = (await request.json()) as ChatRequest;
      const message = body.message?.trim();
      if (!message) {
        return new Response(JSON.stringify({ error: "Message is required" }), {
          status: 400,
          headers: { ...JSON_HEADERS, ...cors },
        });
      }

      const embedding = await embedQuery(message, env);
      const matches = await retrieveDocuments(embedding, env);
      const answer = await generateAnswer(message, matches, env);
      const payload: ChatResponse = {
        answer,
        sources: buildSources(matches),
      };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...JSON_HEADERS, ...cors },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      return new Response(JSON.stringify({ error: "Chat unavailable", detail }), {
        status: 500,
        headers: { ...JSON_HEADERS, ...cors },
      });
    }
  },
};
