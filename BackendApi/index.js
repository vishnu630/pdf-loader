const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const cors = require('cors');

// --- Setup ---
const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PDF_PATH = path.join(__dirname, 'Clean.Code.A.Handbook.of.Agile.Software.Craftsmanship.pdf'); // Change to your actual PDF file
let fullPdfBytes = null;

// --- Load PDF once on startup ---
(async () => {
  try {
    fullPdfBytes = await fs.promises.readFile(PDF_PATH);
    console.log('PDF loaded into memory');
  } catch (err) {
    console.error('Error loading PDF:', err);
  }
})();

// --- WebSocket connection ---
wss.on('connection', (ws) => {
  console.log(' New WebSocket client connected');

  ws.on('message', async (msg) => {
    try {
      const { start, end } = JSON.parse(msg.toString());

      if (!start || !end || !fullPdfBytes) {
        console.warn('Invalid message or PDF not loaded yet');
        return;
      }

      const sourcePdf = await PDFDocument.load(fullPdfBytes);
      const totalPages = sourcePdf.getPageCount();

      const indices = [...Array(end - start + 1).keys()]
        .map((i) => i + start - 1)
        .filter((i) => i >= 0 && i < totalPages);

      if (indices.length === 0) {
        console.warn('No valid pages in requested range.');
        return;
      }

      const targetPdf = await PDFDocument.create();
      const copiedPages = await targetPdf.copyPages(sourcePdf, indices);

      copiedPages.forEach((page) => targetPdf.addPage(page));

      const slicedPdfBytes = await targetPdf.save();

      console.log(`📤 Sent pages ${start}-${end} to client`);

      ws.send(slicedPdfBytes);
    } catch (error) {
      console.error(' Error handling PDF slice:', error);
    }
  });

  ws.on('close', () => {
    console.log(' WebSocket client disconnected');
  });
});

// --- Start server ---
const PORT = 5000;
server.listen(PORT, () => {
  console.log(` Server running at http://localhost:${PORT}`);
});
