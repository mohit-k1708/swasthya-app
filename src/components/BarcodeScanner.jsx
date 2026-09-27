import { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';
import { scanBarcode, explainAlternative } from '../api/scan';
import Mascot from './Mascot';

const ANALYZING_DELAY_MS = 2000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TITLES = {
  scan: 'Scan Barcode',
  analyzing: 'Analyzing…',
  result: 'Result',
};

const GRADE_INFO = {
  A: { color: 'green', message: '🌟 Excellent choice!', tooltip: 'Grade A: minimal sugar, salt & processing — a great everyday pick.' },
  B: { color: 'green', message: '👍 Good choice', tooltip: 'Grade B: a solid, reasonably healthy option.' },
  C: { color: 'orange', message: '🤔 Moderate — enjoy occasionally', tooltip: 'Grade C: some sugar, salt, or processing — fine in moderation.' },
  D: { color: 'red', message: '😬 Poor choice — consume rarely', tooltip: 'Grade D: high in sugar, salt, or additives — best kept occasional.' },
  E: { color: 'red', message: '🚫 Avoid this product', tooltip: 'Grade E: very high sugar/salt/processing — best avoided.' },
};

const ERROR_COPY = {
  not_found: { emoji: '😕', title: "Couldn't find this product.", hint: 'Try another barcode.' },
  api_timeout: { emoji: '🐢', title: 'Our nutrition database is being slow right now.', hint: 'Please try again in a moment.' },
  api_error: { emoji: '🔌', title: 'Having trouble reaching our database.', hint: 'Please try again.' },
  network: { emoji: '📡', title: 'Could not reach the server.', hint: 'Check your connection and try again.' },
  no_barcode: { emoji: '⚠️', title: 'No barcode entered.', hint: 'Type or scan a barcode and try again.' },
};

const ANALYZING_MESSAGE_SWAP_MS = 1100;

const fmt = (value, unit) => (value == null ? '—' : `${value}${unit}`);

function AltImage({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className="alt-image-fallback" aria-hidden="true" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="alt-image"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function BarcodeScanner({ onBack }) {
  const [view, setView] = useState('scan'); // 'scan' | 'analyzing' | 'result'
  const [barcode, setBarcode] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [result, setResult] = useState(null); // { ok, barcode, message }
  const [analyzingStage, setAnalyzingStage] = useState('scanning'); // 'scanning' | 'searching'
  const [showAlternatives, setShowAlternatives] = useState(false);
  // Keyed by alternative name: { status: 'loading' | 'done' | 'error', text, expanded }
  const [altComparisons, setAltComparisons] = useState({});

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
          setCameraStatus('😕 Camera unavailable — no worries, just type the barcode below!');
          setCameraStatusKind('warning');
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
      setInlineError('⚠️ Please enter a barcode to scan.');
      return;
    }
    setInlineError('');
    stopCamera();
    console.log('Barcode:', trimmed);

    const token = ++flowTokenRef.current;
    setPendingCode(trimmed);
    setResult(null);
    setShowAlternatives(false);
    setAltComparisons({});
    setAnalyzingStage('scanning');
    setView('analyzing');

    // Purely cosmetic progress messaging — the real request is one call,
    // but "Analyzing" then "Crunching the nutrition facts" reads as two steps.
    setTimeout(() => {
      if (flowTokenRef.current === token && isMountedRef.current) {
        setAnalyzingStage('searching');
      }
    }, ANALYZING_MESSAGE_SWAP_MS);

    await wait(ANALYZING_DELAY_MS);
    if (flowTokenRef.current !== token || !isMountedRef.current) return;

    try {
      const data = await scanBarcode(trimmed);
      console.log('Backend response:', data);
      if (flowTokenRef.current !== token || !isMountedRef.current) return;
      setResult(data);
    } catch (err) {
      console.error('Backend request failed:', err);
      if (flowTokenRef.current !== token || !isMountedRef.current) return;
      setResult({
        found: false,
        barcode: trimmed,
        message: 'Could not reach the server.',
        reason: 'network',
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

  // Fetches (once) and toggles the "why is this better?" comparison for one
  // alternative card. Already-fetched text is cached in altComparisons, so a
  // second click just re-shows it instead of calling the API again.
  const handleWhyBetter = async (alt) => {
    const current = altComparisons[alt.name];

    if (current && current.status !== 'loading') {
      setAltComparisons((prev) => ({
        ...prev,
        [alt.name]: { ...prev[alt.name], expanded: !prev[alt.name].expanded },
      }));
      return;
    }
    if (current?.status === 'loading') return;

    setAltComparisons((prev) => ({ ...prev, [alt.name]: { status: 'loading', expanded: true } }));

    try {
      const original = {
        barcode: result.barcode,
        name: result.name,
        grade: result.grade,
        nutrition: {
          sugar: result.nutrition?.sugar,
          sodium: result.nutrition?.sodium,
          protein: result.nutrition?.protein,
          additivesCount: result.additivesCount,
        },
      };
      const { comparison } = await explainAlternative(original, alt);
      setAltComparisons((prev) => ({
        ...prev,
        [alt.name]: { status: 'done', text: comparison, expanded: true },
      }));
    } catch (err) {
      console.error('Explain-alternative failed:', err);
      setAltComparisons((prev) => ({ ...prev, [alt.name]: { status: 'error', expanded: true } }));
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
            <div className="analyzing-mascot-wrap">
              <Mascot pose="happy" size={110} className="mascot-bounce" />
            </div>
            <div className="analyzing-spinner" />
            {analyzingStage === 'scanning' ? (
              <p>
                🔍 Sniffing out what's inside <b>{pendingCode}</b>…
              </p>
            ) : (
              <p>📊 Crunching the nutrition facts…</p>
            )}
          </div>
        )}

        {view === 'result' && result && !result.found && (
          <div className="result-view">
            {(() => {
              const errorInfo = ERROR_COPY[result.reason] || ERROR_COPY.not_found;
              return (
                <>
                  <div className="result-badge warn">{errorInfo.emoji}</div>
                  <p className="result-barcode">Barcode: {result.barcode || pendingCode}</p>
                  <p className="result-status warn">{errorInfo.title}</p>
                  <p className="result-hint">{errorInfo.hint}</p>
                </>
              );
            })()}
            <button className="cta" onClick={resetToScan}>
              🔄 Try Again
            </button>
          </div>
        )}

        {view === 'result' && result && result.found && (
          <div className="result-view">
            <p className="result-product-name">{result.name}</p>

            {(() => {
              const gradeInfo = GRADE_INFO[result.grade] || GRADE_INFO.C;
              return (
                <>
                  <div
                    className={`grade-circle grade-${gradeInfo.color}${result.grade === 'E' ? ' grade-emphasis' : ''}`}
                    title={gradeInfo.tooltip}
                  >
                    {result.grade}
                  </div>
                  <p className={`grade-message grade-message-${gradeInfo.color}`}>
                    {gradeInfo.message}
                  </p>
                </>
              );
            })()}

            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-value">{fmt(result.nutrition?.sugar, 'g')}</span>
                <span className="stat-label">Sugar</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">
                  {result.nutrition?.sodium == null ? '—' : `${Math.round(result.nutrition.sodium * 1000)}mg`}
                </span>
                <span className="stat-label">Sodium</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{fmt(result.nutrition?.protein, 'g')}</span>
                <span className="stat-label">Protein</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{result.additivesCount ?? '—'}</span>
                <span className="stat-label">Additives</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{fmt(result.nutrition?.saturatedFat, 'g')}</span>
                <span className="stat-label">Sat. Fat</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{fmt(result.nutrition?.fiber, 'g')}</span>
                <span className="stat-label">Fiber</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{result.novaGroup ?? '—'}</span>
                <span className="stat-label">NOVA</span>
              </div>
            </div>

            {/* The AI card below already explains these same reasons in plain
                language for D/E grades — showing the raw mechanical list too
                would just be the same information twice. A/B/C grades have
                no AI card, so they keep the mechanical list as the only
                explanation. */}
            {result.reasons?.length > 0 && !result.aiExplanation && (
              <ul className="reasons-list">
                {result.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}

            {result.aiExplanation && (
              <div className="ai-explanation-card">
                <p className="ai-explanation-title">🤖 Why this grade?</p>
                <p className="ai-explanation-text">{result.aiExplanation}</p>
              </div>
            )}

            {result.alternatives?.length > 0 && (
              <div className="alternatives-section">
                <button
                  type="button"
                  className="alternatives-toggle"
                  onClick={() => setShowAlternatives((prev) => !prev)}
                  aria-expanded={showAlternatives}
                >
                  {showAlternatives ? 'Hide Alternatives' : 'See Healthier Alternatives'}
                  <span className="alternatives-toggle-arrow">{showAlternatives ? '↑' : '↓'}</span>
                </button>

                {showAlternatives && (
                  <>
                    <h3 className="alternatives-title">🌟 Healthier Alternatives</h3>
                    <div className="alternatives-grid">
                      {result.alternatives.map((alt) => {
                        const altInfo = GRADE_INFO[alt.grade] || GRADE_INFO.C;
                        return (
                          <div className="alt-card" key={alt.name}>
                            <div className="alt-image-wrap">
                              <AltImage src={alt.image} alt={alt.name} />
                            </div>
                            <div
                              className={`grade-circle alt-grade grade-${altInfo.color}`}
                              title={altInfo.tooltip}
                            >
                              {alt.grade}
                            </div>
                            <p className="alt-name">{alt.name}</p>
                            <p className="alt-benefit">{alt.benefit}</p>

                            <button
                              type="button"
                              className="alt-why-better"
                              onClick={() => handleWhyBetter(alt)}
                              disabled={altComparisons[alt.name]?.status === 'loading'}
                            >
                              {altComparisons[alt.name]?.status === 'loading' ? (
                                <span className="alt-why-spinner" aria-hidden="true" />
                              ) : altComparisons[alt.name]?.expanded ? (
                                'Hide comparison'
                              ) : (
                                'Why is this better?'
                              )}
                            </button>

                            {altComparisons[alt.name]?.expanded &&
                              altComparisons[alt.name]?.status === 'done' && (
                                <p className="alt-comparison-text">{altComparisons[alt.name].text}</p>
                              )}
                            {altComparisons[alt.name]?.expanded &&
                              altComparisons[alt.name]?.status === 'error' && (
                                <p className="alt-comparison-text alt-comparison-error">
                                  Couldn't load a comparison right now — try again in a moment.
                                </p>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {result.alternativesMessage && (
              <div className="no-alternatives">
                <p className="no-alternatives-message">💡 {result.alternativesMessage}</p>
                <p className="no-alternatives-suggestion">{result.alternativesSuggestion}</p>
              </div>
            )}

            <button className="cta" onClick={resetToScan}>
              📷 Scan another product
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
