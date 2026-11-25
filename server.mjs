import { createServer } from 'node:http';

const port = Number(process.env.PORT || 8080);

const identityClaim = 'http://schemas.microsoft.com/identity/claims/';
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function renderIdentity(headers) {
  let principal;
  try {
    principal = JSON.parse(Buffer.from(headers['x-ms-client-principal'], 'base64').toString('utf8'));
  } catch {
    principal = null;
  }

  const claims = Array.isArray(principal?.claims) ? principal.claims : [];
  const claim = (...types) => claims.find((entry) =>
    types.includes(entry?.typ) && typeof entry.val === 'string' && entry.val)?.val;
  const provider = headers['x-ms-client-principal-idp'] || principal?.auth_typ;
  const details = [
    ['Display name', claim('name', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname')],
    ['Sign-in name', headers['x-ms-client-principal-name'] || claim('preferred_username', 'upn', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn')],
    ['Identity provider', provider === 'aad' ? 'Microsoft Entra ID' : provider],
    ['User object ID', claim('oid', identityClaim + 'objectidentifier')],
    ['Tenant ID', claim('tid', identityClaim + 'tenantid')]
  ].filter(([, value]) => typeof value === 'string' && value);

  if (!details.length) return '';
  const rows = details.map(([label, value]) =>
    `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`).join('');
  return `<section aria-labelledby="identity"><h2 id="identity">Signed-in user</h2>
    <p>Selected claims supplied by Azure Container Apps</p><dl>${rows}</dl></section>`;
}

createServer((request, response) => {
  const authenticated = Boolean(request.headers['x-ms-client-principal']);
  const status = authenticated ? 'Authenticated' : 'Anonymous';
  const message = authenticated
    ? 'Azure Container Apps supplied an authenticated principal.'
    : 'No authenticated principal was supplied.';
  const identity = authenticated ? renderIdentity(request.headers) : '';
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
  section { border-block: 1px solid #d6e2e6; margin: 1.25rem 0; padding-block: .5rem; }
  dt { font-weight: 650; } dd { margin: 0 0 .9rem; overflow-wrap: anywhere; }
  h1 { line-height: 1.2; } a { color: #005d62; }
</style>
<main>
  <h1>Container Apps and Entra ID</h1>
  <h2>${status}</h2>
  <p>${message}</p>
  ${identity}
  ${signOut}
</main>
</html>`);
}).listen(port, '0.0.0.0');
