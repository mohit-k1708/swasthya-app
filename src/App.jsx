import { useState } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomeScreen from './components/HomeScreen';
import BarcodeScanner from './components/BarcodeScanner';

function App() {
  const [screen, setScreen] = useState('home');

  return (
    <div className="site">
      <Navbar screen={screen} onNavigate={setScreen} />
      <main className="page">
        {screen === 'home' && <HomeScreen onScan={() => setScreen('scan')} />}
        {screen === 'scan' && <BarcodeScanner onBack={() => setScreen('home')} />}
      </main>
      <Footer />
    </div>
  );
}

export default App;
