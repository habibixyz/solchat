import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { fetchAnsemBalance, sendAnsemTip, broadcastTipMessage } from '../services/tipService';

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientWallet: string;
  recipientUsername: string;
  senderUsername: string;
}

export default function TipModal({
  isOpen,
  onClose,
  recipientWallet,
  recipientUsername,
  senderUsername
}: TipModalProps) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [balance, setBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false);
  const [tipAmount, setTipAmount] = useState<string>('0.5');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [broadcast, setBroadcast] = useState<boolean>(true);

  // Transaction States: 'idle' | 'loading' | 'success' | 'error'
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [txSignature, setTxSignature] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const myWallet = wallet.publicKey?.toBase58() ?? '';
  const isSelf = myWallet.toLowerCase() === recipientWallet.toLowerCase();

  // Reset states when opening/closing
  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setTxSignature('');
      setErrorMessage('');
      setCustomMessage('');
      setTipAmount('0.5');
    }
  }, [isOpen]);

  // Fetch balance when wallet/connection/isOpen changes
  useEffect(() => {
    if (isOpen && myWallet) {
      setBalanceLoading(true);
      fetchAnsemBalance(connection, myWallet)
        .then((bal) => {
          setBalance(bal);
        })
        .catch((err) => {
          console.error("Error fetching balance:", err);
          setBalance(0);
        })
        .finally(() => {
          setBalanceLoading(false);
        });
    }
  }, [isOpen, myWallet, connection]);

  if (!isOpen) return null;

  const shortWallet = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;
  const displayRecipient = recipientUsername && recipientUsername !== 'guest' ? `@${recipientUsername}` : shortWallet(recipientWallet);

  const amountVal = parseFloat(tipAmount);
  const isValidAmount = !isNaN(amountVal) && amountVal >= 0.1;
  const hasEnoughBalance = balance >= amountVal;

  const handleQuickSelect = (amt: number) => {
    setTipAmount(String(amt));
  };

  const handleSendTip = async () => {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setErrorMessage("Wallet is not connected or not ready");
      setStatus('error');
      return;
    }
    if (!isValidAmount) {
      alert("Please enter a valid tipping amount.");
      return;
    }
    if (!hasEnoughBalance) {
      alert("Insufficient $ANSEM balance.");
      return;
    }
    if (isSelf) {
      alert("You cannot tip yourself.");
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      // 1. Send SPL Token Transfer
      const sig = await sendAnsemTip(connection, wallet, recipientWallet, amountVal);
      setTxSignature(sig);

      // 2. Broadcast tip to feed if checked
      if (broadcast) {
        await broadcastTipMessage(
          senderUsername,
          myWallet,
          recipientUsername || 'guest',
          amountVal,
          customMessage,
          sig
        ).catch((err) => {
          console.error("Failed to broadcast tip message:", err);
        });
      }

      setStatus('success');
      // Update balance locally after success
      setBalance(prev => Math.max(0, prev - amountVal));
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Transaction failed");
      setStatus('error');
    }
  };

  return (
    <div className="tip-modal-overlay">
      <style>{`
        .tip-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(2, 3, 5, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          font-family: 'Inter', system-ui, sans-serif;
          color: #cbd5f5;
        }
        .tip-modal-content {
          background: rgba(10, 18, 40, 0.95);
          border: 1px solid rgba(0, 247, 255, 0.15);
          border-radius: 16px;
          width: 90%;
          max-width: 440px;
          padding: 24px;
          box-shadow: 0 0 40px rgba(0, 247, 255, 0.1);
          animation: modalFadeIn 0.25s ease-out;
          position: relative;
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .tip-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 12px;
        }
        .tip-modal-title {
          font-size: 18px;
          font-weight: 700;
          color: #00f7ff;
          letter-spacing: 0.5px;
        }
        .tip-modal-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          font-size: 24px;
          cursor: pointer;
          transition: color 0.15s;
        }
        .tip-modal-close:hover {
          color: #fff;
        }
        .tip-modal-recipient-card {
          background: rgba(0, 247, 255, 0.03);
          border: 1px solid rgba(0, 247, 255, 0.08);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .tip-recipient-info {
          display: flex;
          flex-direction: column;
        }
        .tip-recipient-label {
          font-size: 11px;
          color: rgba(0, 247, 255, 0.5);
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .tip-recipient-name {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
        }
        .tip-quick-amounts {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }
        .tip-quick-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 8px 4px;
          color: #cbd5f5;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .tip-quick-btn:hover {
          background: rgba(0, 247, 255, 0.08);
          border-color: rgba(0, 247, 255, 0.3);
          color: #00f7ff;
        }
        .tip-quick-btn.active {
          background: rgba(0, 247, 255, 0.15);
          border-color: #00f7ff;
          color: #00f7ff;
        }
        .tip-input-group {
          margin-bottom: 16px;
        }
        .tip-input-label-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          font-size: 12px;
        }
        .tip-input-label {
          color: rgba(255, 255, 255, 0.6);
        }
        .tip-balance {
          color: rgba(255, 255, 255, 0.4);
        }
        .tip-balance-val {
          color: #00f7ff;
          font-weight: 600;
        }
        .tip-text-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 12px 14px;
          color: #ffffff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .tip-text-input:focus {
          border-color: rgba(0, 247, 255, 0.4);
        }
        .tip-checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
          font-size: 13px;
          cursor: pointer;
          user-select: none;
        }
        .tip-checkbox {
          accent-color: #00f7ff;
          cursor: pointer;
        }
        .tip-submit-btn {
          width: 100%;
          background: linear-gradient(135deg, #00f7ff, #7c6cff);
          border: none;
          border-radius: 10px;
          padding: 14px;
          color: #050a19;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(0, 247, 255, 0.25);
        }
        .tip-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 0 30px rgba(0, 247, 255, 0.45);
        }
        .tip-submit-btn:disabled {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.25);
          box-shadow: none;
          cursor: not-allowed;
        }
        .tip-connect-btn-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
        }
        .tip-state-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px 10px;
          text-align: center;
        }
        .tip-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0, 247, 255, 0.1);
          border-top-color: #00f7ff;
          border-radius: 50%;
          animation: tipSpin 0.8s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes tipSpin {
          to { transform: rotate(360deg); }
        }
        .tip-state-icon {
          font-size: 40px;
          margin-bottom: 16px;
        }
        .tip-state-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .tip-state-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 20px;
          line-height: 1.5;
        }
        .tip-solscan-link {
          color: #00f7ff;
          text-decoration: underline;
          cursor: pointer;
          font-size: 13px;
          font-family: monospace;
          margin-bottom: 20px;
          display: block;
        }
        .tip-error-box {
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.15);
          border-radius: 8px;
          padding: 10px;
          font-size: 12px;
          color: #ef4444;
          font-family: monospace;
          word-break: break-all;
          max-height: 100px;
          overflow-y: auto;
          margin-bottom: 20px;
          width: 100%;
        }
        .tip-secondary-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 12px 24px;
          color: #cbd5f5;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .tip-secondary-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>

      <div className="tip-modal-content" onClick={(e) => e.stopPropagation()}>
        {status === 'idle' && (
          <>
            <div className="tip-modal-header">
              <div className="tip-modal-title">Tip $ANSEM</div>
              <button className="tip-modal-close" onClick={onClose}>&times;</button>
            </div>

            <div className="tip-modal-recipient-card">
              <div className="tip-recipient-info">
                <span className="tip-recipient-label">Recipient</span>
                <span className="tip-recipient-name">{displayRecipient}</span>
              </div>
              <span style={{ fontSize: 24 }}>💸</span>
            </div>

            {!myWallet ? (
              <div className="tip-connect-btn-container">
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 6 }}>
                  Connect your wallet to tip $ANSEM
                </div>
                <WalletMultiButton className="wallet-btn" />
              </div>
            ) : isSelf ? (
              <div style={{ textAlign: 'center', padding: '10px 0', color: '#ef4444', fontSize: 13 }}>
                ⚠ You cannot tip yourself.
              </div>
            ) : (
              <>
                <div className="tip-quick-amounts">
                  {[0.1, 0.5, 1, 5].map((amt) => (
                    <button
                      key={amt}
                      className={`tip-quick-btn ${tipAmount === String(amt) ? 'active' : ''}`}
                      onClick={() => handleQuickSelect(amt)}
                    >
                      {amt < 1 ? amt : amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div className="tip-input-group">
                  <div className="tip-input-label-row">
                    <span className="tip-input-label">Amount ($ANSEM)</span>
                    <span className="tip-balance">
                      Balance:{' '}
                      {balanceLoading ? (
                        <span style={{ opacity: 0.5 }}>...</span>
                      ) : (
                        <span className="tip-balance-val">{balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      )}
                    </span>
                  </div>
                  <input
                    type="number"
                    className="tip-text-input"
                    placeholder="0.00"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                  />
                </div>

                <div className="tip-input-group">
                  <div className="tip-input-label-row">
                    <span className="tip-input-label">Custom Message (Optional)</span>
                  </div>
                  <input
                    type="text"
                    className="tip-text-input"
                    placeholder="Say something nice..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                  />
                </div>

                <label className="tip-checkbox-row">
                  <input
                    type="checkbox"
                    className="tip-checkbox"
                    checked={broadcast}
                    onChange={(e) => setBroadcast(e.target.checked)}
                  />
                  <span>Broadcast tip to global chat feed</span>
                </label>

                <button
                  className="tip-submit-btn"
                  onClick={handleSendTip}
                  disabled={!isValidAmount || !hasEnoughBalance}
                >
                  {!isValidAmount 
                    ? 'Min 0.1 $ANSEM' 
                    : !hasEnoughBalance 
                      ? 'Insufficient Balance' 
                      : `Tip ${amountVal.toLocaleString(undefined, { maximumFractionDigits: 6 })} $ANSEM`}
                </button>
              </>
            )}
          </>
        )}

        {status === 'loading' && (
          <div className="tip-state-container">
            <div className="tip-spinner"></div>
            <div className="tip-state-title">Sending Transaction</div>
            <div className="tip-state-desc">Please approve the transfer in your wallet provider and wait for block confirmation...</div>
          </div>
        )}

        {status === 'success' && (
          <div className="tip-state-container">
            <div className="tip-state-icon">🎉</div>
            <div className="tip-state-title" style={{ color: '#00ba7c' }}>Tip Sent!</div>
            <div className="tip-state-desc">
              Successfully tipped <strong style={{ color: '#fff' }}>{amountVal.toLocaleString()} $ANSEM</strong> to <strong style={{ color: '#fff' }}>{displayRecipient}</strong>.
            </div>
            {txSignature && (
              <a
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noreferrer"
                className="tip-solscan-link"
              >
                View on Solscan ↗
              </a>
            )}
            <button className="tip-secondary-btn" onClick={onClose}>Close</button>
          </div>
        )}

        {status === 'error' && (
          <div className="tip-state-container">
            <div className="tip-state-icon" style={{ color: '#ef4444' }}>❌</div>
            <div className="tip-state-title">Transaction Failed</div>
            <div className="tip-state-desc">An error occurred while executing the transaction. See details below.</div>
            <div className="tip-error-box">{errorMessage}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="tip-secondary-btn" onClick={() => setStatus('idle')}>Retry</button>
              <button className="tip-secondary-btn" style={{ background: 'transparent' }} onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
