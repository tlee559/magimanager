"use client";

import { useState } from "react";

// ============================================================================
// TYPES
// ============================================================================

type AccountOrigin = "mcc-created" | "takeover";

type Identity = {
  id: string;
  fullName: string;
  geo: string;
  email: string | null;
  adAccounts?: { id: string }[];
};

type AddAccountModalProps = {
  onClose: () => void;
  onSubmit: () => void;
  // If provided, skip identity selection (2-step flow)
  preselectedIdentity?: Identity;
  // If no preselectedIdentity, need identities list for selection (3-step flow)
  identities?: Identity[];
  // Optional callback to create new identity
  onCreateIdentity?: () => void;
};

// ============================================================================
// ADD ACCOUNT MODAL
// ============================================================================

export function AddAccountModal({
  onClose,
  onSubmit,
  preselectedIdentity,
  identities = [],
  onCreateIdentity,
}: AddAccountModalProps) {
  // Determine flow based on props
  const hasPreselectedIdentity = !!preselectedIdentity;
  const totalSteps = hasPreselectedIdentity ? 2 : 3;

  // Form state
  const [step, setStep] = useState(1);
  const [origin, setOrigin] = useState<AccountOrigin>("mcc-created");
  const [selectedIdentityId, setSelectedIdentityId] = useState(
    preselectedIdentity?.id || ""
  );
  const [identitySearch, setIdentitySearch] = useState("");
  const [googleCid, setGoogleCid] = useState("");
  const [warmupTargetSpend, setWarmupTargetSpend] = useState(50);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // OAuth picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerAccounts, setPickerAccounts] = useState<{ cid: string; email: string }[]>([]);
  const [existingCids, setExistingCids] = useState<Record<string, number>>({});
  const [selectedPickerCid, setSelectedPickerCid] = useState<string | null>(null);
  const [showConfirmPicker, setShowConfirmPicker] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState("");
  const [oauthConnectionId, setOauthConnectionId] = useState<string | null>(null);

  // Normalize CID by removing dashes for comparison
  const normalizeCid = (cid: string) => cid.replace(/-/g, "");

  // Get the selected identity for display
  const selectedIdentity = preselectedIdentity || identities.find(i => i.id === selectedIdentityId);

  // Handle OAuth picker flow
  async function handleConnectGoogle() {
    setOauthLoading(true);
    setOauthError("");

    // Open OAuth popup
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "/api/oauth/google-ads/authorize?mode=picker",
      "google-oauth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for message from popup
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth-picker-result") return;

      window.removeEventListener("message", handleMessage);
      popup?.close();
      setOauthLoading(false);

      if (!event.data.success) {
        setOauthError(event.data.error || "Failed to connect to Google");
        return;
      }

      const { accounts, email, connectionId } = event.data;

      // Store the OAuth connection ID for account creation
      setOauthConnectionId(connectionId || null);

      // Fetch existing CIDs for duplicate detection
      try {
        const res = await fetch("/api/accounts/cids");
        if (res.ok) {
          const cidMap = await res.json();
          setExistingCids(cidMap);
        }
      } catch {
        // Continue without duplicate detection
      }

      setPickerAccounts(accounts.map((cid: string) => ({ cid, email })));
      setShowPicker(true);
    };

    window.addEventListener("message", handleMessage);

    // Handle popup closed without completing
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        setOauthLoading(false);
      }
    }, 500);
  }

  // Handle picker account selection
  function handlePickerSelect() {
    if (!selectedPickerCid) return;
    const normalized = normalizeCid(selectedPickerCid);
    if (existingCids[normalized]) {
      // Account already exists - can't select it
      return;
    }
    setShowConfirmPicker(true);
  }

  function handlePickerConfirm() {
    if (!selectedPickerCid) return;
    setGoogleCid(selectedPickerCid);
    setShowPicker(false);
    setShowConfirmPicker(false);
    setSelectedPickerCid(null);
  }

  // Filter identities: only show unassigned identities (no linked accounts) and match search
  const filteredIdentities = identities.filter((id) => {
    // Only show identities that don't have an account assigned
    const isUnassigned = !id.adAccounts || id.adAccounts.length === 0;
    // Also match search term
    const matchesSearch = id.fullName.toLowerCase().includes(identitySearch.toLowerCase()) ||
      id.email?.toLowerCase().includes(identitySearch.toLowerCase());
    return isUnassigned && matchesSearch;
  });

  async function handleSubmit() {
    setError("");
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        origin,
        warmupTargetSpend,
        notes: notes || null,
        identityProfileId: selectedIdentityId,
      };

      if (origin === "takeover" || googleCid) {
        body.googleCid = googleCid;
      }

      // If we have an OAuth connection from the picker, include it
      if (oauthConnectionId) {
        body.connectionId = oauthConnectionId;
        body.connectionType = "oauth";
      }

      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create account");
      }

      onSubmit();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  // Navigation helpers
  const canProceedStep1 = origin !== null;
  const canProceedStep2 = hasPreselectedIdentity || !!selectedIdentityId;
  const canSubmit = origin === "takeover" ? googleCid : true;

  // Step label mapping
  const getStepLabel = (stepNum: number) => {
    if (hasPreselectedIdentity) {
      return stepNum === 1 ? "Origin" : "Details";
    }
    return stepNum === 1 ? "Origin" : stepNum === 2 ? "Identity" : "Details";
  };

  // Determine which content to show based on step
  const isOriginStep = step === 1;
  const isIdentityStep = !hasPreselectedIdentity && step === 2;
  const isDetailsStep = hasPreselectedIdentity ? step === 2 : step === 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Add Ad Account</h3>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white transition rounded hover:bg-slate-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {hasPreselectedIdentity && (
            <p className="text-sm text-slate-400 mt-1">For {preselectedIdentity.fullName}</p>
          )}
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`flex items-center ${s < totalSteps ? "flex-1" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {s}
                </div>
                {s < totalSteps && (
                  <div className={`flex-1 h-0.5 mx-2 ${step > s ? "bg-emerald-600" : "bg-slate-700"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <span key={s}>{getStepLabel(s)}</span>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Origin Selection */}
          {isOriginStep && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">What type of account is this?</p>

              <label className={`block p-4 rounded-lg border cursor-pointer transition ${
                origin === "mcc-created"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-700 hover:border-slate-600"
              }`}>
                <input
                  type="radio"
                  name="origin"
                  value="mcc-created"
                  checked={origin === "mcc-created"}
                  onChange={() => setOrigin("mcc-created")}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    origin === "mcc-created" ? "border-emerald-500" : "border-slate-500"
                  }`}>
                    {origin === "mcc-created" && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                  </div>
                  <div>
                    <div className="font-medium text-white">MCC Created</div>
                    <div className="text-sm text-slate-400 mt-0.5">
                      Account we create through our MCC (Manager Account)
                    </div>
                  </div>
                </div>
              </label>

              <label className={`block p-4 rounded-lg border cursor-pointer transition ${
                origin === "takeover"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-700 hover:border-slate-600"
              }`}>
                <input
                  type="radio"
                  name="origin"
                  value="takeover"
                  checked={origin === "takeover"}
                  onChange={() => setOrigin("takeover")}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    origin === "takeover" ? "border-emerald-500" : "border-slate-500"
                  }`}>
                    {origin === "takeover" && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                  </div>
                  <div>
                    <div className="font-medium text-white">Takeover</div>
                    <div className="text-sm text-slate-400 mt-0.5">
                      Inherited or given existing account from someone else
                    </div>
                  </div>
                </div>
              </label>

              <div className="flex justify-between pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-slate-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Identity Selection (only for 3-step flow) */}
          {isIdentityStep && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Which identity profile is this account for?</p>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Search identities..."
                  value={identitySearch}
                  onChange={(e) => setIdentitySearch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500"
                />
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {filteredIdentities.length === 0 ? (
                    <div className="text-sm text-slate-500 py-4 text-center">
                      No identities found.
                      {onCreateIdentity && (
                        <button
                          onClick={() => {
                            onClose();
                            onCreateIdentity();
                          }}
                          className="block mx-auto mt-2 text-emerald-400 hover:text-emerald-300"
                        >
                          Create a new identity first →
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredIdentities.map((identity) => (
                      <label
                        key={identity.id}
                        className={`block p-3 rounded-lg border cursor-pointer transition ${
                          selectedIdentityId === identity.id
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-slate-700 hover:border-slate-600"
                        }`}
                      >
                        <input
                          type="radio"
                          name="identity"
                          value={identity.id}
                          checked={selectedIdentityId === identity.id}
                          onChange={() => setSelectedIdentityId(identity.id)}
                          className="sr-only"
                        />
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-white">{identity.fullName}</div>
                            <div className="text-xs text-slate-400">{identity.email || "No email"}</div>
                          </div>
                          <span className="text-xs text-slate-500">{identity.geo}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>

                {/* Create new identity link */}
                {onCreateIdentity && filteredIdentities.length > 0 && (
                  <div className="pt-2 border-t border-slate-700">
                    <button
                      onClick={() => {
                        onClose();
                        onCreateIdentity();
                      }}
                      className="text-sm text-slate-400 hover:text-emerald-400 transition"
                    >
                      + Create new identity instead
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Final Step: Account Details */}
          {isDetailsStep && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Enter the account details</p>

              {/* OAuth Picker Confirmation */}
              {showConfirmPicker && selectedPickerCid && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <p className="text-sm text-slate-300 mb-3">
                    Are you sure you want to use account{" "}
                    <span className="font-mono text-emerald-400">{selectedPickerCid}</span>?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowConfirmPicker(false)}
                      className="px-3 py-1.5 text-sm text-slate-300 hover:text-white transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handlePickerConfirm}
                      className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition"
                    >
                      Yes, use this account
                    </button>
                  </div>
                </div>
              )}

              {/* OAuth Account Picker */}
              {showPicker && !showConfirmPicker && pickerAccounts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-300">Select a Google Ads account:</p>
                    <button
                      onClick={() => {
                        setShowPicker(false);
                        setSelectedPickerCid(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {pickerAccounts.map(({ cid, email }) => {
                      const normalized = normalizeCid(cid);
                      const existingAccountId = existingCids[normalized];
                      const isExisting = !!existingAccountId;

                      return (
                        <label
                          key={cid}
                          className={`block p-3 rounded-lg border cursor-pointer transition ${
                            isExisting
                              ? "border-amber-500/50 bg-amber-500/10 cursor-not-allowed"
                              : selectedPickerCid === cid
                                ? "border-emerald-500 bg-emerald-500/10"
                                : "border-slate-700 hover:border-slate-600"
                          }`}
                        >
                          <input
                            type="radio"
                            disabled={isExisting}
                            checked={selectedPickerCid === cid}
                            onChange={() => !isExisting && setSelectedPickerCid(cid)}
                            className="sr-only"
                          />
                          <div className="flex justify-between items-center">
                            <div>
                              <span className={`font-mono ${isExisting ? "text-slate-500" : "text-white"}`}>
                                {cid}
                              </span>
                              <span className="text-xs text-slate-500 ml-2">({email})</span>
                            </div>
                            {isExisting && (
                              <span className="text-xs text-amber-400">
                                Already in system (#{existingAccountId})
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    onClick={handlePickerSelect}
                    disabled={!selectedPickerCid || !!existingCids[normalizeCid(selectedPickerCid || "")]}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Use Selected Account
                  </button>
                </div>
              )}

              {/* Normal form (hidden when picker is shown) */}
              {!showPicker && !showConfirmPicker && (
                <>
                  {origin === "takeover" ? (
                    /* Takeover flow - need CID */
                    <>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Google CID <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={googleCid}
                          onChange={(e) => setGoogleCid(e.target.value)}
                          placeholder="XXX-XXX-XXXX (required for takeover)"
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">Google Ads customer ID of the account you&apos;re taking over</p>
                      </div>

                      {/* OAuth Helper Button - only for takeover */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-700" />
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-2 bg-slate-900 text-slate-500">or</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        disabled={oauthLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition"
                      >
                        {oauthLoading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>Connect with Google to auto-fill</span>
                          </>
                        )}
                      </button>
                      <p className="text-xs text-slate-500 text-center">
                        Don&apos;t remember the CID? Connect to see your accounts.
                      </p>

                      {oauthError && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                          {oauthError}
                        </div>
                      )}
                    </>
                  ) : (
                    /* MCC Created - simplified flow, no CID input needed */
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm text-emerald-300 font-medium">New Google Ads Account</p>
                          <p className="text-xs text-slate-400 mt-1">
                            A new Google Ads account will be created under the MCC for <span className="text-white font-medium">{selectedIdentity?.fullName}</span>.
                          </p>
                          <p className="text-xs text-slate-500 mt-2">
                            The account will be automatically named and linked to MagiManager.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Warmup Target Spend ($)</label>
                    <input
                      type="number"
                      min="1"
                      value={warmupTargetSpend}
                      onChange={(e) => setWarmupTargetSpend(parseInt(e.target.value) || 50)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any initial notes..."
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500"
                    />
                  </div>

                  {/* Summary */}
                  <div className="bg-slate-800 rounded-lg p-3 text-sm">
                    <div className="text-slate-400 mb-2">Summary:</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Origin:</span>
                        <span className={`font-medium ${origin === "mcc-created" ? "text-emerald-400" : "text-amber-400"}`}>
                          {origin === "mcc-created" ? "MCC Created" : "Takeover"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Identity:</span>
                        <span className="text-white">
                          {selectedIdentity?.fullName || "Selected"}
                        </span>
                      </div>
                      {selectedIdentity?.geo && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Geo:</span>
                          <span className="text-white">{selectedIdentity.geo}</span>
                        </div>
                      )}
                      {googleCid && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">CID:</span>
                          <span className="text-white font-mono">{googleCid}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(hasPreselectedIdentity ? 1 : 2)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition"
                >
                  Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-slate-300 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition"
                  >
                    {submitting ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
