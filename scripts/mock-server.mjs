import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export function startMockServer(port = 0, host = '127.0.0.1') {
  let targetHits = 0;
  const server = createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const [, mode, ...rest] = (request.url ?? '/').split('/');
      const path = `/${rest.join('/')}`;
      const json = (status, body, headers = {}) => {
        response.writeHead(status, { 'content-type': 'application/json', ...headers });
        response.end(JSON.stringify(body));
      };
      switch (mode) {
        case 'echo': {
          const body = Buffer.concat(chunks).toString('utf8');
          json(path.endsWith('/invoices') && request.method === 'POST' ? 201 : 200, {
            invoice: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', method: request.method, path, headers: request.headers, body },
          });
          return;
        }
        case 'slow':
          setTimeout(() => json(200, { invoice: { id: 'slow' } }), 3000).unref();
          return;
        case 'redirect':
          response.writeHead(302, { location: `/target${path}` });
          response.end();
          return;
        case 'target':
          targetHits += 1;
          json(200, { invoice: { id: 'redirected' } });
          return;
        case 'html502':
          response.writeHead(502, { 'content-type': 'text/html' });
          response.end('<html><body><h1>502 Bad Gateway</h1></body></html>');
          return;
        case 'hits':
          json(200, { target: targetHits });
          return;
        default:
          json(404, { error: { code: 'NOT_FOUND', message: 'Unknown mock mode' } });
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      resolve({ server, url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${address.port}`, port: address.port });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { url } = await startMockServer(Number(process.argv[2] ?? 0), '0.0.0.0');
  console.log(url);
}
