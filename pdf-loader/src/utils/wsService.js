let socket;
export function initSocket(onMessage) {
  socket = new WebSocket('ws://localhost:5000');
  socket.binaryType = 'arraybuffer';
  socket.onmessage = onMessage;
}

export function requestPDFChunk(startPage, endPage) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'getPDFChunk', startPage, endPage }));
  }
}
