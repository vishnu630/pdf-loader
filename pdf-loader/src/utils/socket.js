// src/utils/socket.js
const socket = new WebSocket('ws://localhost:5000');
socket.binaryType = 'arraybuffer';

const sendMessage = (messageObj) => {
  const message = JSON.stringify(messageObj);
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(message);
    console.log('[✅ Sent]', message);
  } else {
    socket.addEventListener('open', () => {
      socket.send(message);
      console.log('[✅ Sent after open]', message);
    }, { once: true });
  }
};

export { socket, sendMessage };
