// src/components/PDFViewer.js

import React, { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { fabric } from 'fabric';
import { socket, sendMessage } from '../utils/socket';

GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const PDFViewer = () => {
  const containerRef = useRef(null);
  const pageCursorRef = useRef(10);
  const loadingRef = useRef(false);
  const [renderedPages, setRenderedPages] = useState(new Set());
  const [annotationMode, setAnnotationMode] = useState(null);
  const [showSpinner, setShowSpinner] = useState(false);
  const [gotoPage, setGotoPage] = useState('');
  const canvases = useRef({});
  const pdfPages = useRef({});

  const extractTextFromRect = async (rect, pdfPage, viewport, pageNum) => {
    const textContent = await pdfPage.getTextContent();
    const { transform } = viewport;

    const scaleX = transform[0];
    const scaleY = transform[3];

    const { left, top, width, height } = rect;

    const x1 = left;
    const y1 = top;
    const x2 = left + width;
    const y2 = top + height;

    const extractedWords = [];

    for (const item of textContent.items) {
      const [tx, ty] = item.transform.slice(4, 6);
      const px = tx * scaleX;
      const py = ty * scaleY;

      if (px >= x1 && px <= x2 && py >= y1 && py <= y2) {
        extractedWords.push(item.str);
      }
    }

    console.log(`📄 Page ${pageNum} - Extracted Text:`, extractedWords.join(' '));
  };

  const renderPDF = async (data) => {
    const pdf = await getDocument({ data }).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
      const pageNum = pdf._pdfInfo.startPage + i - 1;
      if (renderedPages.has(pageNum)) continue;

      const pdfPage = await pdf.getPage(i);
      const scale = 1.5;
      const viewport = pdfPage.getViewport({ scale });

      pdfPages.current[pageNum] = { pdfPage, viewport };

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await pdfPage.render({ canvasContext: context, viewport }).promise;

      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.margin = '0 auto 20px';
      wrapper.style.width = `${canvas.width}px`;
      wrapper.style.height = `${canvas.height}px`;

      wrapper.appendChild(canvas);

      const overlay = document.createElement('canvas');
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      overlay.style.position = 'absolute';
      overlay.style.left = 0;
      overlay.style.top = 0;
      overlay.style.zIndex = 10;

      wrapper.appendChild(overlay);
      containerRef.current.appendChild(wrapper);

      const fabricCanvas = new fabric.Canvas(overlay, {
        isDrawingMode: annotationMode === 'draw',
        selection: true,
      });

      canvases.current[pageNum] = fabricCanvas;
      applyAnnotationModeToCanvas(fabricCanvas, annotationMode, pageNum);

      setRenderedPages((prev) => new Set(prev).add(pageNum));
    }

    loadingRef.current = false;
    setShowSpinner(false);
  };

  const applyAnnotationModeToCanvas = (canvas, mode, pageNum) => {
    canvas.isDrawingMode = mode === 'draw';
    canvas.off('mouse:down');

    if (mode === 'rect') {
      canvas.on('mouse:down', function (opt) {
        const pointer = canvas.getPointer(opt.e);
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 100,
          height: 80,
          fill: 'rgba(0, 0, 255, 0.2)',
          stroke: 'blue',
          strokeWidth: 2,
        });

        canvas.add(rect);
        canvas.setActiveObject(rect);

        setTimeout(() => {
          extractTextFromRect(rect, pdfPages.current[pageNum].pdfPage, pdfPages.current[pageNum].viewport, pageNum);
        }, 1000);
      });
    }

    if (mode === 'text') {
      canvas.on('mouse:down', function (opt) {
        const pointer = canvas.getPointer(opt.e);
        const text = new fabric.Textbox('Type here', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 16,
          fill: 'black',
          width: 200,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.renderAll();
      });
    }
  };

  const applyAnnotationMode = (mode) => {
    setAnnotationMode(mode);
    Object.entries(canvases.current).forEach(([pageNum, canvas]) => {
      applyAnnotationModeToCanvas(canvas, mode, parseInt(pageNum));
    });
  };

  const saveAnnotations = () => {
    const allData = {};
    for (const [pageNum, canvas] of Object.entries(canvases.current)) {
      allData[pageNum] = canvas.toJSON();
    }
    console.log('📦 Saved Annotations:', allData);
  };

  useEffect(() => {
    socket.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        loadingRef.current = true;
        setShowSpinner(true);
        await renderPDF(event.data);
      }
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const el = containerRef.current;
      if (!el || loadingRef.current) return;

      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 150;
      if (nearBottom) {
        const nextStart = pageCursorRef.current + 1;
        const nextEnd = nextStart + 9;
        sendMessage({ start: nextStart, end: nextEnd });
        pageCursorRef.current = nextEnd;
        loadingRef.current = true;
        setShowSpinner(true);
      }
    };

    const el = containerRef.current;
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    sendMessage({ start: 1, end: 10 });
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
      <div style={{ width: '200px', padding: '1rem', background: '#f0f0f0' }}>
        <h3>Tools</h3>
        <button onClick={() => applyAnnotationMode('draw')}>✍️ Free Draw</button><br /><br />
        <button onClick={() => applyAnnotationMode('rect')}>🟥 Rectangle</button><br /><br />
        <button onClick={() => applyAnnotationMode('text')}>🔤 Text</button><br /><br />
        <button onClick={() => applyAnnotationMode(null)}>🚫 Disable</button><br /><br />
        <button onClick={saveAnnotations}>💾 Save</button>
        
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'scroll',
          backgroundColor: '#fff',
          padding: '1rem',
          position: 'relative',
        }}
      >
        {showSpinner && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.8)',
              borderRadius: '8px',
              padding: '20px',
              zIndex: 9999,
              textAlign: 'center',
            }}
          >
            <div className="spinner" />
            <p style={{ marginTop: '10px' }}>Loading more pages...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;
