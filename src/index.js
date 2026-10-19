const config = require('./config');
const { build } = require('./server');

const app = build(config);
const prune = () => {
  const n = app.store.prune(config);
  if (n) app.log.info(`pruned ${n} recipe(s)`);
};

function scheduleNightly() {
  const next = new Date();
  next.setHours(3, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    prune();
    scheduleNightly();
  }, next - Date.now()).unref();
}

prune();
scheduleNightly();

app.listen({ port: config.port, host: config.host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
