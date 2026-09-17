export default function Navbar({ screen, onNavigate }) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <button className="brand" onClick={() => onNavigate('home')}>
          <span className="brand-mark">🌿</span>
          <span className="brand-name">Swasthya</span>
        </button>

        <div className="tagline">Scan &middot; Know &middot; Choose Better</div>

        <button className="nav-cta" onClick={() => onNavigate('scan')}>
          📷 {screen === 'scan' ? 'Scanning' : 'Scan a Product'}
        </button>
      </div>
    </header>
  );
}
