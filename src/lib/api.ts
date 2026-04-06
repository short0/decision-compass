export type Decision = {
  id: string;
  userId: string;
  title: string;
  context: string | null;
  status: string;
  chosenOptionId: string | null;
  reflection: string | null;
  actualOutcome: string | null;
  outcomeDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Option = {
  id: string;
  decisionId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
};

export type Outcome = {
  id: string;
  optionId: string;
  description: string;
  probability: string | number;
  impact: string | number;
  sortOrder: number;
  createdAt: string;
};

export type Premortem = {
  id: string;
  decisionId: string;
  optionId: string | null;
  reason: string;
  severity: string;
  frequency: string;
  sortOrder: number;
  createdAt: string;
};

export type User = {
  id: string;
  email: string | null;
  isGuest: boolean;
};

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    me: () => req<User | null>("/api/auth/me"),
    guest: () => req<User>("/api/auth/guest", { method: "POST" }),
    signup: (email: string, password: string) =>
      req<User>("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
    login: (email: string, password: string) =>
      req<User>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  },

  decisions: {
    list: () => req<Decision[]>("/api/decisions"),
    get: (id: string) => req<Decision>(`/api/decisions/${id}`),
    create: (data: { title: string; context?: string }) =>
      req<Decision>("/api/decisions", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Decision>) =>
      req<Decision>(`/api/decisions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => req<{ ok: boolean }>(`/api/decisions/${id}`, { method: "DELETE" }),
  },

  options: {
    list: (decisionId: string) => req<(Option & { outcomes: Outcome[] })[]>(`/api/decisions/${decisionId}/options`),
    create: (decisionId: string, data: Partial<Option>) =>
      req<Option>(`/api/decisions/${decisionId}/options`, { method: "POST", body: JSON.stringify(data) }),
    update: (optionId: string, data: Partial<Option>) =>
      req<Option>(`/api/decisions/options/${optionId}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (optionId: string) =>
      req<{ ok: boolean }>(`/api/decisions/options/${optionId}`, { method: "DELETE" }),
  },

  outcomes: {
    create: (optionId: string, data: Partial<Outcome>) =>
      req<Outcome>(`/api/decisions/options/${optionId}/outcomes`, { method: "POST", body: JSON.stringify(data) }),
    update: (outcomeId: string, data: Partial<Outcome>) =>
      req<Outcome>(`/api/decisions/outcomes/${outcomeId}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (outcomeId: string) =>
      req<{ ok: boolean }>(`/api/decisions/outcomes/${outcomeId}`, { method: "DELETE" }),
  },

  premortems: {
    list: (decisionId: string) => req<Premortem[]>(`/api/decisions/${decisionId}/premortems`),
    create: (decisionId: string, data: Partial<Premortem>) =>
      req<Premortem>(`/api/decisions/${decisionId}/premortems`, { method: "POST", body: JSON.stringify(data) }),
    update: (pmId: string, data: Partial<Premortem>) =>
      req<Premortem>(`/api/decisions/premortems/${pmId}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (pmId: string) =>
      req<{ ok: boolean }>(`/api/decisions/premortems/${pmId}`, { method: "DELETE" }),
  },

  ai: {
    assist: (action: string, decision: any) =>
      req<{ generated: any }>("/api/ai/assist", { method: "POST", body: JSON.stringify({ action, decision }) }),

    chatStream: async function* (messages: any[], decisionContext: string) {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, decision_context: decisionContext }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") return;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) yield content;
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    },
  },
};
