class OAuthAccountLinkRequiredError extends Error {
  constructor() {
    super("This email already belongs to an account. Sign in with its existing provider before linking another provider.");
    this.code = "OAUTH_ACCOUNT_LINK_REQUIRED";
  }
}

async function findOrCreateGitHubUser(prisma, { providerAccountId, email, name }) {
  const where = {
    provider_providerAccountId: {
      provider: "GITHUB",
      providerAccountId,
    },
  };
  const existingAccount = await prisma.oAuthAccount.findUnique({
    where,
    include: { user: true },
  });
  if (existingAccount) return existingAccount.user;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new OAuthAccountLinkRequiredError();

  try {
    return await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        oauthAccounts: {
          create: {
            provider: "GITHUB",
            providerAccountId,
          },
        },
      },
    });
  } catch (error) {
    if (error.code !== "P2002") throw error;

    const account = await prisma.oAuthAccount.findUnique({ where, include: { user: true } });
    if (account) return account.user;

    const emailOwner = await prisma.user.findUnique({ where: { email } });
    if (emailOwner) throw new OAuthAccountLinkRequiredError();
    throw error;
  }
}

async function ensureDefaultWorkspaceMembership(prisma, userId, workspaceName = "GFG RBU") {
  const workspace = await prisma.workspace.findFirst({
    where: { name: workspaceName },
    select: { id: true },
  });
  if (!workspace) return;

  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
    update: {},
    create: { workspaceId: workspace.id, userId, role: "MEMBER" },
  });
}

module.exports = {
  findOrCreateGitHubUser,
  ensureDefaultWorkspaceMembership,
  OAuthAccountLinkRequiredError,
};
