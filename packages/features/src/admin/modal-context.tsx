"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

type ModalType = "alert" | "confirm" | "success" | "error" | "info" | "prompt";

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  inputValue?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onInputChange?: (value: string) => void;
}

interface ModalContextType {
  modal: ModalState;
  showAlert: (title: string, message: string) => Promise<void>;
  showConfirm: (title: string, message: string, options?: { confirmText?: string; cancelText?: string }) => Promise<boolean>;
  showSuccess: (title: string, message: string) => Promise<void>;
  showError: (title: string, message: string) => Promise<void>;
  showPrompt: (title: string, message: string, options?: { placeholder?: string; confirmText?: string; cancelText?: string }) => Promise<string | null>;
  closeModal: () => void;
}

const defaultModal: ModalState = {
  isOpen: false,
  type: "alert",
  title: "",
  message: "",
};

// ============================================================================
// CONTEXT
// ============================================================================

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(defaultModal);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);
  const [promptResolveRef, setPromptResolveRef] = useState<((value: string | null) => void) | null>(null);
  const [promptValue, setPromptValue] = useState<string>("");

  const closeModal = useCallback(() => {
    setModal(defaultModal);
    if (resolveRef) {
      resolveRef(false);
      setResolveRef(null);
    }
    if (promptResolveRef) {
      promptResolveRef(null);
      setPromptResolveRef(null);
    }
    setPromptValue("");
  }, [resolveRef, promptResolveRef]);

  const showAlert = useCallback((title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: "alert",
        title,
        message,
        confirmText: "OK",
        onConfirm: () => {
          setModal(defaultModal);
          resolve();
        },
      });
    });
  }, []);

  const showConfirm = useCallback((
    title: string,
    message: string,
    options?: { confirmText?: string; cancelText?: string }
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolveRef(() => resolve);
      setModal({
        isOpen: true,
        type: "confirm",
        title,
        message,
        confirmText: options?.confirmText || "Confirm",
        cancelText: options?.cancelText || "Cancel",
        onConfirm: () => {
          setModal(defaultModal);
          setResolveRef(null);
          resolve(true);
        },
        onCancel: () => {
          setModal(defaultModal);
          setResolveRef(null);
          resolve(false);
        },
      });
    });
  }, []);

  const showSuccess = useCallback((title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: "success",
        title,
        message,
        confirmText: "OK",
        onConfirm: () => {
          setModal(defaultModal);
          resolve();
        },
      });
    });
  }, []);

  const showError = useCallback((title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: "error",
        title,
        message,
        confirmText: "OK",
        onConfirm: () => {
          setModal(defaultModal);
          resolve();
        },
      });
    });
  }, []);

  const showPrompt = useCallback((
    title: string,
    message: string,
    options?: { placeholder?: string; confirmText?: string; cancelText?: string }
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptResolveRef(() => resolve);
      setPromptValue("");
      setModal({
        isOpen: true,
        type: "prompt",
        title,
        message,
        placeholder: options?.placeholder || "",
        confirmText: options?.confirmText || "Submit",
        cancelText: options?.cancelText || "Cancel",
        inputValue: "",
        onConfirm: () => {
          // This will be handled by the component with the current promptValue
        },
        onCancel: () => {
          setModal(defaultModal);
          setPromptResolveRef(null);
          setPromptValue("");
          resolve(null);
        },
        onInputChange: (value: string) => {
          setPromptValue(value);
        },
      });
    });
  }, []);

  // Handle prompt submission
  const handlePromptSubmit = useCallback(() => {
    if (promptResolveRef) {
      promptResolveRef(promptValue);
      setPromptResolveRef(null);
    }
    setModal(defaultModal);
    setPromptValue("");
  }, [promptResolveRef, promptValue]);

  return (
    <ModalContext.Provider value={{ modal, showAlert, showConfirm, showSuccess, showError, showPrompt, closeModal }}>
      {children}
      <ModalDialog onPromptSubmit={handlePromptSubmit} promptValue={promptValue} setPromptValue={setPromptValue} />
    </ModalContext.Provider>
  );
}

// ============================================================================
// MODAL DIALOG COMPONENT
// ============================================================================

function ModalDialog({
  onPromptSubmit,
  promptValue,
  setPromptValue
}: {
  onPromptSubmit: () => void;
  promptValue: string;
  setPromptValue: (value: string) => void;
}) {
  const { modal, closeModal } = useModal();

  if (!modal.isOpen) return null;

  const getIcon = () => {
    switch (modal.type) {
      case "success":
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        );
      case "error":
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20">
            <svg className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case "confirm":
      case "prompt":
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
            <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
        );
    }
  };

  const getConfirmButtonClass = () => {
    switch (modal.type) {
      case "error":
        return "bg-rose-500 hover:bg-rose-400 text-white";
      case "success":
        return "bg-emerald-500 hover:bg-emerald-400 text-slate-950";
      case "confirm":
      case "prompt":
        return "bg-amber-500 hover:bg-amber-400 text-slate-950";
      default:
        return "bg-blue-500 hover:bg-blue-400 text-white";
    }
  };

  const handleConfirmClick = () => {
    if (modal.type === "prompt") {
      onPromptSubmit();
    } else if (modal.onConfirm) {
      modal.onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={(modal.type === "confirm" || modal.type === "prompt") ? modal.onCancel : modal.onConfirm}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl transition-all">
          {/* Icon */}
          {getIcon()}

          {/* Content */}
          <div className="mt-4 text-center">
            <h3 className="text-lg font-semibold text-slate-100">
              {modal.title}
            </h3>
            <p className="mt-2 text-sm text-slate-400 whitespace-pre-line">
              {modal.message}
            </p>
          </div>

          {/* Prompt Input */}
          {modal.type === "prompt" && (
            <div className="mt-4">
              <input
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={modal.placeholder}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && promptValue.trim()) {
                    onPromptSubmit();
                  }
                }}
              />
            </div>
          )}

          {/* Buttons */}
          <div className={`mt-6 flex gap-3 justify-center`}>
            {(modal.type === "confirm" || modal.type === "prompt") && (
              <button
                type="button"
                onClick={modal.onCancel}
                className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition"
              >
                {modal.cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={modal.type === "prompt" && !promptValue.trim()}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${getConfirmButtonClass()} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {modal.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
