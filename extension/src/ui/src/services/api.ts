const API_BASE_URL = "http://localhost:8000";

/* =========================
   PROVIDERS
   ========================= */

export interface Provider {
  id: string;
  name?: string;
}

/* =========================
   MODELS
   ========================= */

export interface Model {
  id: string;
  name?: string;
}

/* =========================
   AGENT PLAN
   ========================= */

export interface AgentPlanRequest {
  task: string;
  provider: string;
  model: string;
}

export interface AgentPlanResponse {
  [key: string]: unknown;
}

/* =========================
   GET PROVIDERS
   ========================= */

export async function getProviders(): Promise<Provider[]> {
  const response = await fetch(
    `${API_BASE_URL}/providers`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load providers: ${response.status}`
    );
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.providers)) {
    return data.providers;
  }
  return [];
}

/* =========================
   GET MODELS
   ========================= */

export async function getModels(
  provider: string,
  apiKey?: string
): Promise<Model[]> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  
  const response = await fetch(
    `${API_BASE_URL}/providers/${encodeURIComponent(
      provider
    )}/models`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load models: ${response.status}`
    );
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.models)) {
    return data.models;
  }
  return [];
}

/* =========================
   POST AGENT PLAN
   ========================= */

export async function planAgentTask(
  request: AgentPlanRequest
): Promise<AgentPlanResponse> {
  const response = await fetch(
    `${API_BASE_URL}/agent/plan`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Agent plan request failed: ${response.status}`
    );
  }

  return response.json();
}