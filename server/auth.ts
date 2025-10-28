import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  // Use SUPABASE or DATABASE_URL for session storage
  const connectionString = process.env.SUPABASE || process.env.DATABASE_URL;
  
  // Use memory store if database connection is not available
  let sessionStore;
  try {
    if (connectionString) {
      sessionStore = new pgStore({
        conString: connectionString,
        createTableIfMissing: false,
        ttl: sessionTtl,
        tableName: "sessions",
      });
    }
  } catch (error) {
    console.warn("Could not create PG session store, using memory store instead:", error);
  }
  
  const sessionConfig = {
    secret: process.env.SESSION_SECRET!,
    store: sessionStore, // Will use memory store if sessionStore is undefined
    resave: false,
    saveUninitialized: false, // Don't create session until something is stored
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      maxAge: sessionTtl,
    },
  };
  
  console.log('Session configuration:', {
    hasStore: !!sessionStore,
    storeType: sessionStore ? 'PostgreSQL' : 'Memory',
    cookieSettings: sessionConfig.cookie
  });
  
  return session(sessionConfig);
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  // Session middleware is already applied in index.ts
  app.use(passport.initialize());
  app.use(passport.session());

  console.log("Setting up simple login/password authentication.");
  
  // Setup local strategy for username/password authentication
  passport.use(new LocalStrategy(
    {
      usernameField: 'login',
      passwordField: 'senha'
    },
    async (username: string, password: string, done) => {
      try {
        // Check against environment variables
        const validLogin = process.env.LOGIN;
        const validPassword = process.env.SENHA;
        
        if (username === validLogin && password === validPassword) {
          const user = {
            id: 'admin',
            login: username,
            isAdmin: true
          };
          return done(null, user);
        } else {
          return done(null, false, { message: 'Credenciais inválidas' });
        }
      } catch (error) {
        return done(error);
      }
    }
  ));

  passport.serializeUser((user: any, cb) => cb(null, user));
  passport.deserializeUser((user: any, cb) => cb(null, user));
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Middleware to check if user is admin
export const isAdmin: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const user = req.user as any;
  if (!user || !user.isAdmin) {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }
  
  next();
};