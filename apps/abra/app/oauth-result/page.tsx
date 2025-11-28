'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense, useMemo, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Plus, Link } from 'lucide-react';

function OAuthResultContent() {
  const searchParams = useSearchParams();
  const [isAdding, setIsAdding] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedCid, setSelectedCid] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<{ success: boolean; message: string } | null>(null);
  const [linkResult, setLinkResult] = useState<{ success: boolean; message: string; cid?: string } | null>(null);

  const status = searchParams.get('status');
  const message = searchParams.get('message');
  const cid = searchParams.get('cid');
  const connectionId = searchParams.get('connectionId');
  const accountId = searchParams.get('accountId');
  const email = searchParams.get('email');
  const cidsParam = searchParams.get('cids');
  const accountName = searchParams.get('accountName');

  // Parse accessible CIDs for account picker
  const accessibleCids = useMemo(() => {
    if (!cidsParam) return [];
    return cidsParam.split(',').filter(Boolean);
  }, [cidsParam]);

  const handleQuickAdd = async () => {
    if (!cid || !connectionId) return;

    setIsAdding(true);
    try {
      const response = await fetch('/api/oauth/google-ads/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid, connectionId }),
      });

      const data = await response.json();

      if (response.ok) {
        setAddResult({ success: true, message: `Account ${cid} has been added and connected!` });
      } else {
        setAddResult({ success: false, message: data.error || 'Failed to add account' });
      }
    } catch {
      setAddResult({ success: false, message: 'Network error' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleLinkAccount = async () => {
    if (!accountId || !connectionId || !selectedCid) return;

    setIsLinking(true);
    try {
      const response = await fetch('/api/oauth/google-ads/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, connectionId, selectedCid }),
      });

      const data = await response.json();

      if (response.ok) {
        setLinkResult({ success: true, message: data.message, cid: data.cid });
      } else {
        setLinkResult({ success: false, message: data.error || 'Failed to link account' });
      }
    } catch {
      setLinkResult({ success: false, message: 'Network error' });
    } finally {
      setIsLinking(false);
    }
  };

  // Format CID with dashes for display
  const formatCid = (cid: string) => {
    const clean = cid.replace(/\D/g, '');
    if (clean.length === 10) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return cid;
  };

  // Account picker state - show after successful link
  if (linkResult) {
    if (linkResult.success) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Account Linked!</h1>
            <p className="text-zinc-400 mb-4">
              Google Ads account <span className="text-white font-mono">{formatCid(linkResult.cid || '')}</span> is now connected.
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              Your account will now sync automatically every hour.
            </p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Link Failed</h1>
            <p className="text-zinc-400 mb-6">{linkResult.message}</p>
            <button
              onClick={() => setLinkResult(null)}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
  }

  // PICKER MODE: Send accounts back to parent window (Add Account modal)
  // This uses postMessage to communicate with the opener window
  useEffect(() => {
    if (status === 'picker' && window.opener) {
      const errorParam = searchParams.get('error');

      if (errorParam) {
        // Send error to parent
        window.opener.postMessage({
          type: 'oauth-picker-result',
          success: false,
          error: errorParam,
        }, window.location.origin);
      } else {
        // Send accounts to parent
        window.opener.postMessage({
          type: 'oauth-picker-result',
          success: true,
          email: email,
          accounts: accessibleCids,
        }, window.location.origin);
      }

      // Close popup after a short delay to ensure message is sent
      setTimeout(() => window.close(), 100);
    }
  }, [status, email, accessibleCids, searchParams]);

  // Picker mode - show a brief "returning" message
  if (status === 'picker') {
    const errorParam = searchParams.get('error');
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
          {errorParam ? (
            <>
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">No Accounts Found</h1>
              <p className="text-zinc-400 mb-4">{errorParam}</p>
              <button
                onClick={() => window.close()}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Accounts Found!</h1>
              <p className="text-zinc-400">Returning to form...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Account picker state - user selects which CID to link
  if (status === 'select_account') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-lg w-full">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Link className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 text-center">Select Google Ads Account</h1>
          <p className="text-zinc-400 mb-2 text-center">
            Connected as <span className="text-white">{email}</span>
          </p>
          <p className="text-zinc-500 text-sm mb-6 text-center">
            Linking to: <span className="text-zinc-300">{accountName}</span>
          </p>

          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {accessibleCids.map((cidOption) => (
              <button
                key={cidOption}
                onClick={() => setSelectedCid(cidOption)}
                className={`w-full px-4 py-3 rounded-lg border text-left transition-colors ${
                  selectedCid === cidOption
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <span className="font-mono">{formatCid(cidOption)}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleLinkAccount}
              disabled={!selectedCid || isLinking}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Link className="w-5 h-5" />
              {isLinking ? 'Linking...' : 'Link Selected Account'}
            </button>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Account Connected!</h1>
          {cid && (
            <p className="text-zinc-400 mb-4">
              Google Ads account <span className="text-white font-mono">{cid}</span> is now connected to MagiManager.
            </p>
          )}
          {email && (
            <p className="text-zinc-400 mb-4">
              Connected as <span className="text-white">{email}</span>
            </p>
          )}
          <p className="text-sm text-zinc-500 mb-6">
            Your account will now sync automatically every hour.
          </p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  // Not found state - offer quick add
  if (status === 'not_found' && !addResult) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Account Not Found</h1>
          <p className="text-zinc-400 mb-6">
            Google Ads account <span className="text-white font-mono">{cid}</span> doesn't exist in MagiManager yet.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleQuickAdd}
              disabled={isAdding}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              {isAdding ? 'Adding...' : 'Add Account Now'}
            </button>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quick add result
  if (addResult) {
    if (addResult.success) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Account Added!</h1>
            <p className="text-zinc-400 mb-4">{addResult.message}</p>
            <p className="text-sm text-zinc-500 mb-6">
              The account will sync automatically. You can add more details (media buyer, notes) from the dashboard.
            </p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Failed to Add</h1>
            <p className="text-zinc-400 mb-6">{addResult.message}</p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      );
    }
  }

  // Error state
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Connection Failed</h1>
        <p className="text-zinc-400 mb-6">{message || 'An unknown error occurred'}</p>
        <button
          onClick={() => window.close()}
          className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}

export default function OAuthResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="text-zinc-400">Loading...</div>
        </div>
      }
    >
      <OAuthResultContent />
    </Suspense>
  );
}
