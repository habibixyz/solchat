import { useNavigate, useParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';

const navigate = useNavigate();
const { publicKey } = useWallet();
const { wallet } = useParams();

const myWallet = publicKey?.toBase58() ?? '';
const profileWallet = wallet ?? '';

const isOwnProfile = myWallet === profileWallet;

{!isOwnProfile && myWallet && (
  <button
    onClick={() => navigate(`/dm?dm=${profileWallet}`)}
    style={{
      background: '#071420',
      border: '1px solid #1e5a8a',
      color: '#4fc3f7',
      padding: '8px 20px',
      cursor: 'pointer',
      borderRadius: '4px',
      fontSize: '11px',
      fontFamily: "'Courier New', monospace",
      letterSpacing: '2px',
      marginTop: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.15s',
      width: '100%',
      justifyContent: 'center',
    }}
    onMouseEnter={e => {
      (e.target as HTMLButtonElement).style.background = '#0a2040';
      (e.target as HTMLButtonElement).style.borderColor = '#2a7ab8';
    }}
    onMouseLeave={e => {
      (e.target as HTMLButtonElement).style.background = '#071420';
      (e.target as HTMLButtonElement).style.borderColor = '#1e5a8a';
    }}
  >
    🔒 DIRECT MESSAGE
  </button>
)}