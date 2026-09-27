import router from './backend/routes/plan.js';
if (!router || !router.stack) {
  console.error('Router or stack not found');
  process.exit(1);
}
const routes = router.stack.filter(layer => layer.route).map(layer => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));
console.log(JSON.stringify(routes, null, 2));
