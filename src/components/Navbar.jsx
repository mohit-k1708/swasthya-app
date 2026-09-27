export default function Navbar({ onNavigate }) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <button className="brand" onClick={() => onNavigate('home')}>
          <span className="brand-mark">🌿</span>
          <span className="brand-name">Swasthya</span>
        </button>

        <div className="tagline">Scan &middot; Know &middot; Choose Better</div>
      </div>
    </header>
  );
}
