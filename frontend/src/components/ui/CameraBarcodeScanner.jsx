import { useState, useEffect, useRef, useCallback } from "react";

function beepSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = 1800;
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.stop(ctx.currentTime + 0.1);
  } catch(e) {}
}

export default function CameraBarcodeScanner({ onScan, onClose, onProductNotFound }) {
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("detecting");
  const [flashOn, setFlashOn] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [lastCode, setLastCode] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const quaggaRef = useRef(null);
  const stopRef = useRef(false);
  const mountedRef = useRef(true);
  const lastScanRef = useRef("");
  const lastScanTimeRef = useRef(0);
  const flashTrackRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    init();
    return () => {
      mountedRef.current = false;
      stopRef.current = true;
      cleanup();
    };
  }, []);

  function cleanup() {
    if (quaggaRef.current) {
      try { quaggaRef.current.stop(); } catch(e) {}
      quaggaRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  const handleScan = useCallback((code) => {
    const now = Date.now();
    if (code === lastScanRef.current && now - lastScanTimeRef.current < 1500) return;
    lastScanRef.current = code;
    lastScanTimeRef.current = now;
    
    // Feedback
    beepSound();
    try { navigator.vibrate?.(50); } catch(e) {}
    
    setScannedCount(n => n + 1);
    setLastCode(code);
    
    onScan(code);
  }, [onScan]);

  async function init() {
    try {
      if ("BarcodeDetector" in window) {
        const formats = await BarcodeDetector.getSupportedFormats();
        const target = formats.filter(f =>
          ["ean_8", "ean_13", "upc_a", "upc_e", "code_128", "code_39"].includes(f)
        );
        if (target.length > 0) {
          await startNative(target);
          return;
        }
      }
      await startQuagga();
    } catch {
      if (mountedRef.current) setError("No se pudo iniciar la camara");
    }
  }

  function toggleFlash() {
    if (flashTrackRef.current) {
      flashTrackRef.current.applyConstraints({ advanced: [{ torch: !flashOn }] })
        .then(() => setFlashOn(!flashOn))
        .catch(() => {});
    }
  }

  async function startNative(formats) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      
      const videoTrack = stream.getVideoTracks()[0];
      flashTrackRef.current = videoTrack;
      
      setMode("native");
      await new Promise(r => setTimeout(r, 50));
      if (!videoRef.current) { stream.getTracks().forEach(t => t.stop()); if (mountedRef.current) setError("No se pudo iniciar la camara"); return; }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      
      const detector = new BarcodeDetector({ formats });
      
      function tick() {
        if (stopRef.current || !mountedRef.current) return;
        if (videoRef.current && videoRef.current.readyState >= 2) {
          detector.detect(videoRef.current).then(barcodes => {
            if (!stopRef.current && barcodes.length > 0) {
              handleScan(barcodes[0].rawValue);
            }
            requestAnimationFrame(tick);
          }).catch(() => { requestAnimationFrame(tick); });
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    } catch (e) {
      if (!mountedRef.current) return;
      if (e.name === "NotAllowedError") {
        setError("Permiso de camara denegado");
      } else {
        setError("No se pudo acceder a la camara");
      }
    }
  }

  async function startQuagga() {
    try {
      const { default: Quagga } = await import("@ericblade/quagga2");
      quaggaRef.current = Quagga;
      setMode("quagga");
      await new Promise(r => setTimeout(r, 50));
      const targetEl = document.getElementById("quagga-viewport");
      if (!targetEl || !mountedRef.current) return;
      
      // Get stream for flashlight control
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        flashTrackRef.current = stream.getVideoTracks()[0];
        stream.getTracks().forEach(t => t.stop());
      } catch(e) {}
      
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: targetEl,
          constraints: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        },
        decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader"], multiple: false },
        locate: true,
        numOfWorkers: 0,
        frequency: 10,
      }, (err) => {
        if (err) { if (mountedRef.current) setError("Error al iniciar el escaner"); return; }
        if (stopRef.current) { Quagga.stop(); return; }
        Quagga.start();
      });
      Quagga.onDetected((result) => {
        if (stopRef.current) return;
        const code = result.codeResult.code;
        if (code) {
          handleScan(code);
        }
      });
    } catch (e) {
      if (!mountedRef.current) return;
      if (e.name === "NotAllowedError") {
        setError("Permiso de camara denegado");
      } else {
        setError("No se pudo iniciar el escaner");
      }
    }
  }

  const CloseIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const FlashIcon = () => (
    <svg width="22" height="22" fill={flashOn ? "#FFD700" : "none"} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 2000, flexDirection: "column", padding: "16px"
    }}>
      <style>
        {"@keyframes scanner-laser { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } } #quagga-viewport video, #quagga-viewport canvas { position:absolute; inset:0; width:100% !important; height:100% !important; object-fit:cover; }"}
      </style>
      <div style={{
        position: "relative", width: "100%", maxWidth: "420px",
        aspectRatio: "3/4", background: "#000", borderRadius: "16px",
        overflow: "hidden", border: "2px solid rgba(255,255,255,0.1)"
      }}>
        {error ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "32px", color: "#fff", textAlign: "center" }}>
            <p style={{ fontSize: "1rem", lineHeight: 1.5, margin: "0 0 24px 0" }}>{error}</p>
            <button onClick={onClose} style={{
              padding: "10px 32px", background: "linear-gradient(135deg, #14BBA6, #0E9E8D)",
              border: "none", color: "#fff", borderRadius: "8px", cursor: "pointer",
              fontWeight: 700, fontSize: "0.95rem"
            }}>Cerrar</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: mode === "native" ? 1 : 0, position: mode === "native" ? "relative" : "absolute", pointerEvents: mode === "native" ? "auto" : "none" }} />
            <div id="quagga-viewport" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: mode === "quagga" ? 1 : 0, pointerEvents: mode === "quagga" ? "auto" : "none" }} />
            {mode === "detecting" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#fff" }}>
                <p style={{ fontSize: "0.95rem" }}>Iniciando camara...</p>
              </div>
            )}

            <div style={{
              position: "absolute", inset: "20%", border: "2px solid rgba(255,255,255,0.3)",
              borderRadius: "12px", pointerEvents: "none"
            }}>
              <div style={{
                position: "absolute", left: 0, right: 0, height: "2px",
                background: "var(--accent-primary, #14BBA6)",
                boxShadow: "0 0 6px rgba(20,187,166,0.8)",
                top: "50%", transform: "translateY(-50%)"
              }}>
                <div style={{
                  position: "absolute", top: "-6px", bottom: "-6px", left: 0, right: 0,
                  background: "linear-gradient(180deg, rgba(20,187,166,0) 0%, rgba(20,187,166,0.6) 50%, rgba(20,187,166,0) 100%)",
                  animation: "scanner-laser 2.5s ease-in-out infinite"
                }} />
              </div>
            </div>

            {/* Top controls: close + flashlight + counter */}
            <div style={{ position: "absolute", top: "12px", left: "12px", right: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {scannedCount > 0 && (
                  <div style={{ background: "rgba(20,187,166,0.9)", color: "#fff", padding: "4px 12px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 700 }}>
                    {scannedCount} escaneado{scannedCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={toggleFlash} style={{
                  width: "36px", height: "36px", background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: flashOn ? "#FFD700" : "#fff"
                }}>
                  <FlashIcon />
                </button>
                <button onClick={onClose} style={{
                  width: "36px", height: "36px", background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#fff"
                }}>
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Bottom: status text + last scanned */}
            <div style={{ position: "absolute", bottom: "16px", left: "12px", right: "12px", textAlign: "center", pointerEvents: "none" }}>
              {lastCode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ background: "rgba(0,0,0,0.6)", color: "var(--accent-primary, #14BBA6)", padding: "4px 16px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    {lastCode}
                  </span>
                  <p style={{ color: "#fff", fontSize: "0.78rem", margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
                    Apunta al siguiente producto
                  </p>
                </div>
              ) : (
                <p style={{ color: "#fff", fontSize: "0.85rem", margin: 0, textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
                  Apunta al codigo de barras
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}