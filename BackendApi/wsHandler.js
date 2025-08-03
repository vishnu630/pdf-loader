export function handleWSConnection(ws, req) {
  console.log('🔌 Client connected via WS');

  ws.send('👋 Welcome to the /live stream');

  // Echo messages
  ws.on('message', message => {
    console.log('📨 Received:', message.toString());
    ws.send(`🪞 Echo: ${message}`);
  });

  // Periodic updates
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(`🕒 ${new Date().toISOString()}`);
    }
  }, 2000);

  // Cleanup
  ws.on('close', () => {
    console.log('❌ Client disconnected');
    clearInterval(interval);
  });
}
