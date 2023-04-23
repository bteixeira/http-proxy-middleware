import type * as http from 'http';
import { createSession } from 'better-sse';
import * as EventSource from 'eventsource';
import * as express from 'express';
import * as getPort from 'get-port';
import { createAppWithPath, createProxyMiddleware } from './test-kit';
import { RequestHandler } from '../../src';

describe('E2E SSE proxy', () => {
  let proxyServer: http.Server;
  let targetSSEServer: http.Server;

  const targetSSEApp = express();

  targetSSEApp.get('/sse', async (req, res) => {
    const session = await createSession(req, res);
    return session.push('Hello SSE world!');
  });

  let sseProxyMiddleware: RequestHandler;

  beforeEach(async () => {
    const targetSSEServerPort = await getPort();

    return new Promise((resolve: any) => {
      sseProxyMiddleware = createProxyMiddleware({
        target: `http://localhost:${targetSSEServerPort}/sse`,
      });

      targetSSEServer = targetSSEApp.listen(targetSSEServerPort, resolve);
    });
  });

  afterEach(() => {
    return Promise.all([
      new Promise((resolve) => targetSSEServer.close(resolve)),
      new Promise((resolve) => proxyServer.close(resolve)),
    ]);
  });

  it('should proxy SSE request', async () => {
    const freePort = await getPort();
    proxyServer = createAppWithPath('/sse', sseProxyMiddleware).listen(freePort);

    const sse = new EventSource(`http://localhost:${freePort}/sse`);

    const message = await new Promise((resolve) => {
      sse.addEventListener('message', ({ data }) => resolve(data));
    });

    sse.close();
    expect(message).toBe(`"Hello SSE world!"`);
  });
});
