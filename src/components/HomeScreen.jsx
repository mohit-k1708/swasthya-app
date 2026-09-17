import Mascot from './Mascot';

export default function HomeScreen({ onScan }) {
  return (
    <>
      <section className="hero-section">
        <div className="hero-text">
          <div className="eyebrow">Same food. A healthier you.</div>
          <h1>
            Good food.
            <br />
            <span className="accent">Happy you.</span>
          </h1>
          <p className="lead">
            Scan any barcode, see the nutrition grade instantly, and make
            better choices — one product at a time.
          </p>
          <button className="cta" onClick={onScan}>
            📷 Scan a Product →
          </button>
          <ul className="checklist">
            <li>✅ Eat Smart</li>
            <li>✅ Stay Fit</li>
            <li>✅ Feel Great</li>
            <li>✅ Make a Better World</li>
          </ul>
        </div>

        <div className="hero-art">
          <div className="hero-blob">
            <Mascot pose="happy" size={260} />
          </div>
          <div className="hero-bubble">
            "I'll scan it for you!" 🌿
            <small>Let's discover what's inside.</small>
          </div>
        </div>
      </section>

      <section className="features-section">
        <h2>Why Swasthya?</h2>
        <div className="grid">
          <div className="card">
            🔍<b>Know ingredients</b>
            <small>Understand additives.</small>
          </div>
          <div className="card">
            💧<b>Understand nutrition</b>
            <small>See sugar & protein.</small>
          </div>
          <div className="card">
            ⭐<b>Get a grade</b>
            <small>A = Best, E = Avoid.</small>
          </div>
          <div className="card">
            ❤️<b>Build habits</b>
            <small>Scan everyday.</small>
          </div>
        </div>
      </section>

      <section className="steps-section">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <b>Scan</b>
            <p>Point your camera at any barcode.</p>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <b>Analyze</b>
            <p>We check ingredients & nutrition.</p>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <b>Choose better</b>
            <p>Get an instant A–E grade.</p>
          </div>
        </div>
      </section>
    </>
  );
}
