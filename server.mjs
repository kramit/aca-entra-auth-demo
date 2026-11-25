import { createServer } from 'node:http';

const port = Number(process.env.PORT || 8080);

createServer((request, response) => {
  const authenticated = Boolean(request.headers['x-ms-client-principal']);
  const status = authenticated ? 'Authenticated' : 'Anonymous';
  const message = authenticated
    ? 'Azure Container Apps supplied an authenticated principal.'
    : 'No authenticated principal was supplied.';
  const signOut = authenticated ? '<a href="/.auth/logout">Sign out</a>' : '';

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.url !== '/') {
    response.writeHead(404).end('Page not found');
    return;
  }

  response.end(`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Container Apps and Entra ID</title>
<style>
  body { font: 1rem/1.6 system-ui, sans-serif; background: #edf5f7; color: #132c3d; margin: 0; padding: 8vh 1rem; }
  main { max-width: 40rem; margin: auto; background: white; border-radius: 1rem; padding: clamp(1.2rem, 5vw, 3rem); border-top: .4rem solid #007578; }
  h1 { line-height: 1.2; } a { color: #005d62; }
</style>
<main>
  <h1>Container Apps and Entra ID</h1>
  <h2>${status}</h2>
  <p>${message}</p>
  ${signOut}
</main>
</html>`);
}).listen(port, '0.0.0.0');
