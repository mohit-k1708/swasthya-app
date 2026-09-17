import { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';
import { scanBarcode } from '../api/scan';

const ANALYZING_DELAY_MS = 2000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TITLES = {
  scan: 'Scan Barcode',
  analyzing: 'Analyzing…',
  result: 'Result',
};

export default function BarcodeScanner({ onBack }) {
  const [view, setView] = useState('scan'); // 'scan' | 'analyzing' | 'result'
  const [barcode, setBarcode] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [result, setResult] = useState(null); // { ok, barcode, message }

  const [isScanning, setIsScanning] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('');
  const [cameraStatusKind, setCameraStatusKind] = useState('');

  const viewportRef = useRef(null);
  const lastDetectedRef = useRef('');
  const isMountedRef = useRef(true);
  const flowTokenRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    Quagga.offDetected(handleDetected);
    try {
      Quagga.stop();
    } catch {
      // Quagga wasn't running — nothing to stop.
    }
    setIsScanning(false);
  };

  const startCamera = () => {
    setCameraStatus('');
    setCameraStatusKind('');
    setIsScanning(true);

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          // viewportRef.current is always mounted while view === 'scan', so
          // it's guaranteed to exist here — Quagga looks it up synchronously.
          target: viewportRef.current,
          constraints: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        },
        locator: {
          patchSize: 'medium',
          halfSample: true,
        },
        numOfWorkers: navigator.hardwareConcurrency ? 2 : 0,
        decoder: {
          readers: [
            'ean_reader',
            'ean_8_reader',
            'code_128_reader',
            'upc_reader',
            'upc_e_reader',
          ],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error('Quagga init failed:', err);
          setCameraStatus('Camera unavailable — check permissions, or enter the barcode manually.');
          setCameraStatusKind('error');
          setIsScanning(false);
          return;
        }
        Quagga.start();
        Quagga.onDetected(handleDetected);
      }
    );
  };

  const handleDetected = (detection) => {
    const code = detection?.codeResult?.code;
    if (!code || code === lastDetectedRef.current) return;
    lastDetectedRef.current = code;
    setBarcode(code);
    runScanFlow(code);
  };

  // Runs Scan -> Analyzing (fixed delay) -> POST to backend -> Result.
  // flowTokenRef lets a stale flow (user hit Back mid-analysis) bail out
  // instead of yanking the user back to the result screen later.
  const runScanFlow = async (rawCode) => {
    const trimmed = rawCode.trim();
    if (!trimmed) {
      setInlineError('Please enter a barcode');
      return;
    }
    setInlineError('');
    stopCamera();
    console.log('Barcode:', trimmed);

    const token = ++flowTokenRef.current;
    setPendingCode(trimmed);
    setResult(null);
    setView('analyzing');

    await wait(ANALYZING_DELAY_MS);
    if (flowTokenRef.current !== token || !isMountedRef.current) return;

    try {
      const data = await scanBarcode(trimmed);
      console.log('Backend response:', data);
      if (flowTokenRef.current !== token || !isMountedRef.current) return;
      setResult({ ok: true, barcode: data.barcode, message: data.message });
    } catch (err) {
      console.error('Backend request failed:', err);
      if (flowTokenRef.current !== token || !isMountedRef.current) return;
      setResult({
        ok: false,
        barcode: trimmed,
        message: 'Could not reach the server. Is it running on localhost:4000?',
      });
    }

    if (flowTokenRef.current === token && isMountedRef.current) {
      setView('result');
    }
  };

  const resetToScan = () => {
    flowTokenRef.current += 1; // invalidate any in-flight analyzing/fetch
    setView('scan');
    setResult(null);
    setBarcode('');
  };

  const handleBack = () => {
    if (view === 'scan') {
      onBack();
    } else {
      resetToScan();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      runScanFlow(barcode);
    }
  };

  return (
    <section className="scan-page">
      <div className="scan-card">
        <div className="scan-card-top">
          <button className="back-btn" onClick={handleBack}>
            ‹
          </button>
          <h2>{TITLES[view]}</h2>
        </div>

        {view === 'scan' && (
          <>
            <p>Point your camera at a barcode (EAN, UPC, Code128), or enter it manually.</p>

            <div className="manual-row">
              <input
                type="text"
                className="search"
                placeholder="🔍 Enter barcode..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="cta yellow manual-scan-btn"
                onClick={() => runScanFlow(barcode)}
              >
                Scan Now
              </button>
            </div>

            {inlineError && <div className="status-line error">{inlineError}</div>}

            <div className="scan-area">
              <div ref={viewportRef} id="quagga-viewport" className={isScanning ? 'live' : ''} />
              {!isScanning && (
                <div className="frame">
                  <div className="barcode-display">||||||||||||||||</div>
                  <div className="line" />
                </div>
              )}
            </div>

            <div className={`status-line${cameraStatusKind ? ` ${cameraStatusKind}` : ''}`}>
              {cameraStatus}
            </div>

            <button className="cta" onClick={isScanning ? stopCamera : startCamera}>
              {isScanning ? '⏹ Stop Camera' : '📷 Start Camera'}
            </button>
          </>
        )}

        {view === 'analyzing' && (
          <div className="analyzing-view">
            <div className="analyzing-spinner" />
            <p>
              Checking barcode <b>{pendingCode}</b>…
            </p>
          </div>
        )}

        {view === 'result' && result && (
          <div className="result-view">
            <div className={`result-badge ${result.ok ? 'ok' : 'bad'}`}>
              {result.ok ? '✅' : '❌'}
            </div>
            <p className="result-barcode">Barcode: {result.barcode}</p>
            <p className={`result-status ${result.ok ? 'ok' : 'bad'}`}>
              {result.ok ? 'Successfully received' : result.message}
            </p>
            <button className="cta" onClick={resetToScan}>
              📷 Scan another product
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
