import { useState } from 'react';

export default function Mascot({ pose = 'happy', size = 240, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`mascot-fallback ${className}`} style={{ width: size, height: size, fontSize: size * 0.45 }}>
        🧑‍🌾
      </div>
    );
  }

  return (
    <img
      src={`/mascot/${pose}.png`}
      alt="Nivo, the Swasthya mascot"
      className={`mascot-img ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
