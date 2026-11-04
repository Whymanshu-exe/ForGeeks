require("dotenv/config");

const prisma = require("../src/database/prisma");

async function main() {
  const emailArgument = process.argv.find((argument) => argument.startsWith("--email="));
  const email = emailArgument?.slice("--email=".length).trim().toLowerCase();
  const workspaceArgument = process.argv.find((argument) => argument.startsWith("--workspace="));
  const workspaceName = workspaceArgument?.slice("--workspace=".length).trim() || "GFG RBU";

  if (!email || !workspaceName) {
    throw new Error('Usage: npm run seed:admin -- --email="verified-github-email" [--workspace="GFG RBU"]');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("That user does not exist yet. Sign in with GitHub first, then run this command.");
  }

  await prisma.$transaction(async (transaction) => {
    const workspace = await transaction.workspace.findFirst({ where: { name: workspaceName } })
      || await transaction.workspace.create({ data: { name: workspaceName } });

    await transaction.membership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: { role: "OWNER" },
      create: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
    });

    await transaction.project.upsert({
      where: { workspaceId_key: { workspaceId: workspace.id, key: "GFG" } },
      update: {},
      create: { workspaceId: workspace.id, name: "General", key: "GFG" },
    });
  });

  console.info(`Granted OWNER in "${workspaceName}" to ${email}.`);
}

main()
  .catch((error) => {
    console.error("Could not bootstrap workspace owner:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
