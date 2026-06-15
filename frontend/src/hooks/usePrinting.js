import { useState, useEffect } from 'react';
import { apiGet } from '../services/apiClient';
import * as QZTray from '../services/qzTray';

export default function usePrinting() {
  const [qzConnected, setQzConnected] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    enabled: true,
    mode: 'window_print',
    auto_open_drawer: true,
    auto_print_ticket: true,
    printer_name: '',
  });

  useEffect(() => {
    const connect = async () => {
      try {
        const res = await apiGet('/config/printing');
        if (res.ok) {
          const cfg = await res.json();
          setPrintConfig(prev => ({ ...prev, ...cfg }));
        }
      } catch (e) { console.error(e) }
      try {
        const ok = await QZTray.connectQZTray(3000);
        setQzConnected(ok);
      } catch {
        setQzConnected(false);
      }
    };
    connect();
    return () => { QZTray.disconnectQZTray().catch(() => {}); };
  }, []);

  return { qzConnected, setQzConnected, printConfig, setPrintConfig };
}
