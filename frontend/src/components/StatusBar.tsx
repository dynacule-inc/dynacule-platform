'use client';

import { useEffect, useRef, useState } from 'react';

export default function StatusBar() {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<string>('Idle');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8000/ws/status`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          setStatus(data.message);
        } else if (data.type === 'progress') {
          setStatus(`${data.message} (${data.current}/${data.total})`);
        } else if (data.type === 'done') {
          setStatus('Complete');
        }
      } catch {
        setStatus(event.data);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-navy text-cream font-mono text-xs flex items-center px-4 gap-4 z-40">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
      <span className="truncate">{status}</span>
    </div>
  );
}