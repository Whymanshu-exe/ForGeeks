const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const request = require("supertest");

let app;
let prisma;

test("GitHub OAuth starts with state and a PostgreSQL-backed session", {
  skip: process.env.RUN_DB_INTEGRATION !== "true",
}, async () => {
  process.env.GITHUB_CLIENT_ID = "ci-github-client";
  process.env.GITHUB_CLIENT_SECRET = "ci-github-secret";
  app = require("../src/app");
  prisma = require("../src/database/prisma");

  const response = await request(app).get("/api/auth/github").redirects(0);

  assert.equal(response.status, 302);
  const authorizationUrl = new URL(response.headers.location);
  assert.equal(authorizationUrl.hostname, "github.com");
  assert.ok(authorizationUrl.searchParams.get("state"));
  assert.ok(response.headers["set-cookie"]?.some((cookie) => cookie.startsWith("gfg-rbu.sid=")));
});

test("PostgreSQL persists GitHub provider identity with its user", {
  skip: process.env.RUN_DB_INTEGRATION !== "true",
}, async () => {
  prisma ||= require("../src/database/prisma");
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `ci-${suffix}@example.test`,
      name: "CI OAuth member",
      oauthAccounts: {
        create: {
          provider: "GITHUB",
          providerAccountId: `github-${suffix}`,
        },
      },
    },
    include: { oauthAccounts: true },
  });

  try {
    assert.equal(user.oauthAccounts.length, 1);
    assert.equal(user.oauthAccounts[0].provider, "GITHUB");
    const linkedUser = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "GITHUB",
          providerAccountId: `github-${suffix}`,
        },
      },
      include: { user: true },
    });
    assert.equal(linkedUser.user.id, user.id);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test.after(async () => {
  if (app) await app.locals.close();
  else if (prisma) await prisma.$disconnect();
});
