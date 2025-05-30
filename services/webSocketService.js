const WebSocket = require('ws');
const { SpeedTest } = require('../models');

let wss;
const clients = new Map();

function initializeWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const clientId = require('uuid').v4();
    clients.set(clientId, {
      ws,
      sessionToken: null,
      lastActivity: Date.now()
    });

    console.log(`📡 WebSocket client connected: ${clientId}`);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        await handleWebSocketMessage(clientId, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`📡 WebSocket client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(clientId);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString()
    }));
  });

  // Clean up inactive clients every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [clientId, client] of clients.entries()) {
      if (now - client.lastActivity > 5 * 60 * 1000) { // 5 minutes
        client.ws.terminate();
        clients.delete(clientId);
      }
    }
  }, 5 * 60 * 1000);

  console.log('📡 WebSocket server initialized');
}

async function handleWebSocketMessage(clientId, data) {
  const client = clients.get(clientId);
  if (!client) return;

  client.lastActivity = Date.now();

  switch (data.type) {
    case 'subscribe':
      client.sessionToken = data.sessionToken;
      client.ws.send(JSON.stringify({
        type: 'subscribed',
        sessionToken: data.sessionToken
      }));
      break;

    case 'speedtest_start':
      broadcastToSession(client.sessionToken, {
        type: 'speedtest_started',
        timestamp: new Date().toISOString()
      });
      break;

    case 'speedtest_progress':
      broadcastToSession(client.sessionToken, {
        type: 'speedtest_progress',
        progress: data.progress,
        currentSpeed: data.currentSpeed
      });
      break;

    case 'speedtest_complete':
      broadcastToSession(client.sessionToken, {
        type: 'speedtest_completed',
        results: data.results
      });
      break;

    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      client.ws.send(JSON.stringify({ error: 'Unknown message type' }));
  }
}

function broadcastToSession(sessionToken, message) {
  if (!sessionToken) return;

  for (const client of clients.values()) {
    if (client.sessionToken === sessionToken && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
}

function broadcastToAll(message) {
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
}

module.exports = {
  initializeWebSocket,
  broadcastToSession,
  broadcastToAll
};