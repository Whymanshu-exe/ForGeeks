const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { createWorkspaceRouter } = require("../src/api/workspace");

const userId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const ticketId = "44444444-4444-4444-8444-444444444444";
const frontendUrl = "http://localhost:5173";

function createHarness({ prisma = {}, authenticated = true, role = "MEMBER", fetchImpl } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: userId, name: "Signed-in member" };
    req.isAuthenticated = () => authenticated;
    next();
  });
  app.use("/api", createWorkspaceRouter({
    prisma: {
      membership: {
        findFirst: async () => ({
          workspaceId,
          userId,
          role,
          workspace: { id: workspaceId, name: "GFG RBU" },
        }),
        findUnique: async () => ({ id: "membership-id" }),
      },
      ...prisma,
    },
    frontendUrl,
    fetchImpl: fetchImpl || (async () => {
      throw new Error("Gemini must not be called by default");
    }),
  }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : "Unexpected error" });
  });
  return app;
}

function ticketRecord() {
  const now = new Date("2026-11-04T10:00:00.000Z");
  return {
    id: ticketId,
    ticketKey: "GFG-1",
    title: "Add ticket API",
    description: "Persist workspace work.",
    status: "OPEN",
    priority: "MEDIUM",
    labels: [],
    githubUrl: null,
    createdAt: now,
    updatedAt: now,
    project: { id: projectId, key: "GFG", name: "General" },
    reporter: { id: userId, name: "Signed-in member", email: "member@example.test" },
    assignee: null,
    comments: [],
  };
}

test("workspace APIs require an authenticated session", async () => {
  const response = await request(createHarness({ authenticated: false })).get("/api/tickets");

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "Not signed in" });
});

test("workspace APIs reject authenticated users without membership", async () => {
  const app = createHarness({
    prisma: { membership: { findFirst: async () => null } },
  });

  const response = await request(app).get("/api/projects");

  assert.equal(response.status, 403);
  assert.match(response.body.error, /not a member/i);
});

test("ticket creation allocates the project key and records activity transactionally", async () => {
  const calls = { projectLookup: null, create: null, activity: null };
  const record = ticketRecord();
  const app = createHarness({
    prisma: {
      project: {
        findFirst: async ({ where }) => {
          calls.projectLookup = where;
          return { id: projectId, key: "GFG" };
        },
      },
      $transaction: async (callback) => callback({
        project: {
          update: async () => ({ nextTicketNumber: 2 }),
        },
        ticket: {
          create: async ({ data }) => {
            calls.create = data;
            return { ...record, ...data, id: ticketId };
          },
        },
        activity: {
          create: async ({ data }) => { calls.activity = data; },
        },
      }),
    },
  });

  const response = await request(app)
    .post("/api/tickets")
    .set("Origin", frontendUrl)
    .send({ projectId, title: "Create a real ticket", description: "A real description", priority: "HIGH" });

  assert.equal(response.status, 201);
  assert.equal(response.body.ticket.key, "GFG-1");
  assert.equal(response.body.ticket.status, "Open");
  assert.equal(calls.projectLookup.workspaceId, workspaceId);
  assert.equal(calls.create.reporterId, userId);
  assert.equal(calls.activity.action, "TICKET_CREATED");
});

test("ticket mutations reject untrusted origins", async () => {
  const app = createHarness({
    prisma: { project: { findFirst: async () => ({ id: projectId, key: "GFG" }) } },
  });

  const response = await request(app).post("/api/tickets").send({
    projectId,
    title: "Create a real ticket",
  });

  assert.equal(response.status, 403);
  assert.match(response.body.error, /origin/i);
});

test("workspace members cannot assign tickets", async () => {
  const app = createHarness({
    prisma: { ticket: { findFirst: async () => ticketRecord() } },
  });

  const response = await request(app)
    .patch(`/api/tickets/${ticketId}`)
    .set("Origin", frontendUrl)
    .send({ assigneeId: "55555555-5555-4555-8555-555555555555" });

  assert.equal(response.status, 403);
  assert.match(response.body.error, /owners and admins/i);
});

test("ticket detail lookup uses the human-readable key without querying UUID id", async () => {
  let where;
  const record = ticketRecord();
  const app = createHarness({
    prisma: {
      ticket: {
        findFirst: async (input) => {
          where = input.where;
          return record;
        },
      },
    },
  });

  const response = await request(app).get("/api/tickets/GFG-1");

  assert.equal(response.status, 200);
  assert.deepEqual(where.OR, [{ ticketKey: "GFG-1" }]);
  assert.equal(response.body.ticket.key, "GFG-1");
});

test("ticket detail lookup supports UUID ids and human-readable keys", async () => {
  let where;
  const app = createHarness({
    prisma: {
      ticket: {
        findFirst: async (input) => {
          where = input.where;
          return ticketRecord();
        },
      },
    },
  });

  const response = await request(app).get(`/api/tickets/${ticketId}`);

  assert.equal(response.status, 200);
  assert.deepEqual(where.OR, [{ ticketKey: ticketId }, { id: ticketId }]);
});

test("Gemini endpoint reports missing server configuration without fake answers", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const response = await request(createHarness())
      .post("/api/assistant")
      .set("Origin", frontendUrl)
      .send({ question: "What tickets are open?" });

    assert.equal(response.status, 503);
    assert.match(response.body.error, /not configured/i);
  } finally {
    if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;
  }
});

test("ticket search is scoped to the current workspace", async () => {
  let where;
  const app = createHarness({
    prisma: {
      ticket: {
        findMany: async (input) => {
          where = input.where;
          return [];
        },
      },
    },
  });

  const response = await request(app).get("/api/tickets?q=cache&mine=true");

  assert.equal(response.status, 200);
  assert.equal(where.project.workspaceId, workspaceId);
  assert.match(JSON.stringify(where.AND), /cache/);
  assert.match(JSON.stringify(where.AND), new RegExp(userId));
});

test("project creation is limited to workspace admins and owners", async () => {
  const app = createHarness({
    role: "MEMBER",
    prisma: { project: { create: async () => { throw new Error("Should not create project"); } } },
  });

  const response = await request(app)
    .post("/api/projects")
    .set("Origin", frontendUrl)
    .send({ name: "Frontend", key: "WEB" });

  assert.equal(response.status, 403);
  assert.match(response.body.error, /owners and admins/i);
});

test("admins cannot change an owner's role", async () => {
  const app = createHarness({
    role: "ADMIN",
    prisma: {
      membership: {
        findFirst: async () => ({
          workspaceId,
          userId,
          role: "ADMIN",
          workspace: { id: workspaceId, name: "GFG RBU" },
        }),
        findUnique: async () => ({ userId, role: "OWNER" }),
      },
    },
  });

  const response = await request(app)
    .patch(`/api/team/${userId}/role`)
    .set("Origin", frontendUrl)
    .send({ role: "ADMIN" });

  assert.equal(response.status, 403);
  assert.match(response.body.error, /only a workspace owner/i);
});

test("the final workspace owner cannot be demoted", async () => {
  const app = createHarness({
    role: "OWNER",
    prisma: {
      membership: {
        findFirst: async () => ({
          workspaceId,
          userId,
          role: "OWNER",
          workspace: { id: workspaceId, name: "GFG RBU" },
        }),
        findUnique: async () => ({ userId, role: "OWNER" }),
        count: async () => 1,
      },
    },
  });

  const response = await request(app)
    .patch(`/api/team/${userId}/role`)
    .set("Origin", frontendUrl)
    .send({ role: "ADMIN" });

  assert.equal(response.status, 409);
  assert.match(response.body.error, /at least one owner/i);
});

test("Gemini receives only current workspace tickets and returns grounded references", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  delete process.env.GEMINI_MODEL;
  let requestBody;
  let headers;
  let requestUrl;
  try {
    const app = createHarness({
      prisma: {
        ticket: {
          findMany: async ({ where }) => {
            assert.equal(where.project.workspaceId, workspaceId);
            return [{
              ticketKey: "GFG-1",
              title: "Cache search results",
              description: "Cache repeated searches.",
              status: "OPEN",
              priority: "HIGH",
              labels: ["backend"],
              project: { name: "General", key: "GFG" },
              reporter: { name: "Reporter" },
              assignee: null,
            }];
          },
        },
      },
      fetchImpl: async (url, options) => {
        assert.match(url, /generativelanguage\.googleapis\.com/);
        requestUrl = url;
        headers = options.headers;
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: "GFG-1 is the open ticket about caching search results." }] } }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });

    const response = await request(app)
      .post("/api/assistant")
      .set("Origin", frontendUrl)
      .send({ question: "Which ticket is about caching?" });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.references, [{ key: "GFG-1", title: "Cache search results" }]);
    assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent");
    assert.equal(headers["x-goog-api-key"], "test-gemini-key");
    assert.match(requestBody.contents[0].parts[0].text, /Cache search results/);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
  }
});

test("Gemini model-not-found errors explain how to restore the assistant", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  try {
    const app = createHarness({
      prisma: { ticket: { findMany: async () => [] } },
      fetchImpl: async () => new Response(JSON.stringify({
        error: { message: "Model is no longer available" },
      }), { status: 404, headers: { "content-type": "application/json" } }),
    });

    const response = await request(app)
      .post("/api/assistant")
      .set("Origin", frontendUrl)
      .send({ question: "What is open?" });

    assert.equal(response.status, 503);
    assert.match(response.body.error, /GEMINI_MODEL.*gemini-3\.5-flash/i);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
