require("dotenv/config");

const cors = require("cors");
const express = require("express");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const passport = require("passport");
const helmet = require("helmet");
const { Strategy: GitHubStrategy } = require("passport-github2");
const { Pool } = require("pg");
const prisma = require("./database/prisma");
const { findOrCreateGitHubUser, ensureDefaultWorkspaceMembership } = require("./auth/accounts");
const { createWorkspaceRouter } = require("./api/workspace");

const requiredEnvironment = ["DATABASE_URL", "SESSION_SECRET"];
for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`${name} must be set before starting the server`);
}

const port = Number(process.env.PORT || 4000);
const backendUrl = process.env.BACKEND_URL || `http://localhost:${port}`;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters in production");
}

if (Boolean(process.env.GITHUB_CLIENT_ID) !== Boolean(process.env.GITHUB_CLIENT_SECRET)) {
  throw new Error("GitHub OAuth requires both a client ID and a client secret");
}

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
const PgSessionStore = connectPgSimple(session);
const app = express();

app.set("trust proxy", isProduction ? 1 : false);
app.use(helmet());
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json({ limit: "16kb" }));
app.use(session({
  name: "gfg-rbu.sid",
  store: new PgSessionStore({ pool: pgPool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
    done(null, user || false);
  } catch (error) {
    done(error);
  }
});

function createVerifyCallback(getVerifiedEmail) {
  return (accessToken, refreshToken, profile, done) => {
    void (async () => {
      const email = await getVerifiedEmail(accessToken, profile);
      if (!email) throw new Error("GitHub did not provide a verified email address");
      const user = await findOrCreateGitHubUser(prisma, {
        providerAccountId: profile.id,
        email: email.toLowerCase(),
        name: profile.displayName,
      });
      await ensureDefaultWorkspaceMembership(prisma, user.id);
      return user;
    })().then((user) => done(null, user), done);
  };
}

const hasGitHubOAuth = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
if (hasGitHubOAuth) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${backendUrl}/api/auth/github/callback`,
    scope: ["read:user", "user:email"],
    state: true,
  }, createVerifyCallback(async (accessToken) => {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) throw new Error(`GitHub email lookup failed with status ${response.status}`);
    const emails = await response.json();
    return emails.find((item) => item.primary && item.verified)?.email || null;
  })));
}

function startOAuth(provider, options) {
  return (req, res, next) => {
    if (!options.configured) {
      return res.redirect(`${frontendUrl}/login?error=${provider}_not_configured`);
    }
    return passport.authenticate(provider, options.authenticate)(req, res, next);
  };
}

function finishOAuth(provider) {
  return (req, res, next) => {
    passport.authenticate(provider, (error, user) => {
      if (error) {
        if (error.code === "OAUTH_ACCOUNT_LINK_REQUIRED") {
          return res.redirect(`${frontendUrl}/login?error=account_link_required`);
        }
        console.error("OAuth authentication failed:", error);
        return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      }
      if (!user) return res.redirect(`${frontendUrl}/login?error=oauth_failed`);

      req.logIn(user, (loginError) => {
        if (loginError) return next(loginError);
        return res.redirect(`${frontendUrl}/`);
      });
    })(req, res, next);
  };
}

app.get("/api/auth/github", startOAuth("github", {
  configured: hasGitHubOAuth,
  authenticate: { scope: ["read:user", "user:email"], state: true },
}));
app.get("/api/auth/github/callback", finishOAuth("github"));

app.get("/api/auth/me", (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Not signed in" });
  return res.json({ user: req.user });
});

app.post("/api/auth/logout", (req, res, next) => {
  if (req.get("origin") !== frontendUrl) {
    return res.status(403).json({ error: "Request origin is not allowed" });
  }
  req.logout((logoutError) => {
    if (logoutError) return next(logoutError);
    req.session.destroy((sessionError) => {
      if (sessionError) return next(sessionError);
      res.clearCookie("gfg-rbu.sid", {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
      });
      return res.status(204).end();
    });
  });
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", createWorkspaceRouter({ prisma, frontendUrl }));

app.locals.close = async () => {
  await Promise.all([prisma.$disconnect(), pgPool.end()]);
};

app.use((error, req, res, next) => {
  if (!error.status || error.status >= 500) console.error("Request failed:", error);
  if (res.headersSent) return next(error);
  return res.status(error.status || 500).json({
    error: error.status ? error.message : "An unexpected server error occurred",
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`GFG RBU API listening on ${backendUrl}`);
  });
}

module.exports = app;
