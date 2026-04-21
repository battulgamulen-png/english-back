const fs = require("node:fs");
const path = require("node:path");
const port = Number(process.env.PORT || 4000);

const loadEnvFile = (filename) => {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim().replace(/^"|"$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const sendJson = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
};

const readJsonBody = async (req) => {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
  }

  if (!raw) return {};
  return JSON.parse(raw);
};

const supabaseRequest = async (pathname, options = {}) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing SUPABASE_URL and one of NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  const response = await fetch(`${supabaseUrl}${pathname}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
};

const getTodos = async () => {
  return supabaseRequest("/rest/v1/todos?select=*&order=id.desc");
};

const createTodo = async (text) => {
  try {
    return await supabaseRequest("/rest/v1/todos", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify([{ title: text }]),
    });
  } catch {
    return supabaseRequest("/rest/v1/todos", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify([{ task: text }]),
    });
  }
};

const deleteTodo = async (id) => {
  await supabaseRequest(
    `/rest/v1/todos?id=eq.${encodeURIComponent(String(id))}`,
    {
      method: "DELETE",
    }
  );
};

const server = require("http").createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.url === "/health" && req.method === "GET") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.url === "/api/todos" && req.method === "GET") {
      const todos = await getTodos();
      sendJson(res, 200, { todos });
      return;
    }

    if (req.url === "/api/todos" && req.method === "POST") {
      const body = await readJsonBody(req);
      const text = String(body?.text || "").trim();
      if (!text) {
        sendJson(res, 400, { error: "text is required" });
        return;
      }

      const rows = await createTodo(text);
      sendJson(res, 201, { todo: rows?.[0] ?? null });
      return;
    }

    if (req.url?.startsWith("/api/todos/") && req.method === "DELETE") {
      const id = req.url.split("/").at(-1);
      if (!id) {
        sendJson(res, 400, { error: "id is required" });
        return;
      }

      await deleteTodo(id);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, {
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
