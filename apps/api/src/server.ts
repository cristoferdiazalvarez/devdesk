import { database } from "./database.js";
import { createApp } from "./app.js";
import { settings } from "./config.js";
const db = database(settings.DATABASE_URL);
const app = createApp(db, {
  origin: settings.WEB_ORIGIN,
  production: settings.NODE_ENV === "production",
  allowRegistration: settings.ALLOW_REGISTRATION
    ? settings.ALLOW_REGISTRATION === "true"
    : settings.NODE_ENV !== "production",
  proxyHops: settings.TRUST_PROXY_HOPS,
  demo: settings.DEMO_VIEW === "true",
});
await db.$connect();
const server = app.listen(
  settings.PORT,
  settings.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  () => console.log(`DevDesk API · puerto ${settings.PORT}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () =>
    server.close(() => {
      void db.$disconnect().finally(() => process.exit(0));
    }),
  );
