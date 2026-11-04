const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findOrCreateGitHubUser,
  OAuthAccountLinkRequiredError,
} = require("../src/auth/accounts");

function createPrismaMock({ account = null, user = null, create } = {}) {
  const calls = { accountLookups: 0, userLookups: 0, creates: [] };
  return {
    calls,
    oAuthAccount: {
      findUnique: async () => {
        calls.accountLookups += 1;
        return account;
      },
    },
    user: {
      findUnique: async () => {
        calls.userLookups += 1;
        return user;
      },
      create: async ({ data }) => {
        calls.creates.push(data);
        if (create) return create(data);
        return { id: "new-user", ...data };
      },
    },
  };
}

test("returns the application user for an already-linked GitHub account", async () => {
  const linkedUser = { id: "user-1", email: "member@example.test" };
  const prisma = createPrismaMock({ account: { user: linkedUser } });

  const result = await findOrCreateGitHubUser(prisma, {
    providerAccountId: "github-123",
    email: "member@example.test",
    name: "Member",
  });

  assert.equal(result, linkedUser);
  assert.equal(prisma.calls.userLookups, 0);
  assert.equal(prisma.calls.creates.length, 0);
});

test("creates a user and a GitHub account together for a new identity", async () => {
  const prisma = createPrismaMock();

  await findOrCreateGitHubUser(prisma, {
    providerAccountId: "github-123",
    email: "member@example.test",
    name: "Member",
  });

  assert.deepEqual(prisma.calls.creates[0], {
    email: "member@example.test",
    name: "Member",
    oauthAccounts: {
      create: { provider: "GITHUB", providerAccountId: "github-123" },
    },
  });
});

test("does not automatically link an existing email to a new GitHub identity", async () => {
  const prisma = createPrismaMock({ user: { id: "existing-user" } });

  await assert.rejects(
    findOrCreateGitHubUser(prisma, {
      providerAccountId: "github-456",
      email: "member@example.test",
      name: "Member",
    }),
    OAuthAccountLinkRequiredError,
  );
  assert.equal(prisma.calls.creates.length, 0);
});

test("recovers a concurrent first-login race by loading the created provider account", async () => {
  const linkedUser = { id: "user-1" };
  const prisma = createPrismaMock({
    create: async () => {
      const error = new Error("Unique constraint");
      error.code = "P2002";
      throw error;
    },
  });
  prisma.oAuthAccount.findUnique = async () => {
    prisma.calls.accountLookups += 1;
    return prisma.calls.accountLookups === 1 ? null : { user: linkedUser };
  };

  const result = await findOrCreateGitHubUser(prisma, {
    providerAccountId: "github-123",
    email: "member@example.test",
    name: "Member",
  });

  assert.equal(result, linkedUser);
});
