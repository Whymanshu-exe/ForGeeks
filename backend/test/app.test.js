process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";
process.env.SESSION_SECRET ||= "unit-test-session-secret-with-sufficient-length";
process.env.GITHUB_CLIENT_ID = "";
process.env.GITHUB_CLIENT_SECRET = "";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");

test("health endpoint reports readiness without exposing configuration", async () => {
  const response = await request(app).get("/api/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("current-user endpoint rejects an unauthenticated request", async () => {
  const response = await request(app).get("/api/auth/me");

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "Not signed in" });
});

test("GitHub OAuth returns to login with a helpful message when unconfigured", async () => {
  const response = await request(app).get("/api/auth/github").redirects(0);

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.location,
    "http://localhost:5173/login?error=github_not_configured",
  );
});

test("API responses include security headers", async () => {
  const response = await request(app).get("/api/health");

  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
});
