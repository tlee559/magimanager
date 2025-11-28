"use client";

import { SessionProvider } from "next-auth/react";
import { ReactQueryProvider } from "@/lib/react-query";
import { ModalProvider } from "@magimanager/features/admin";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ReactQueryProvider>
        <ModalProvider>
          {children}
        </ModalProvider>
      </ReactQueryProvider>
    </SessionProvider>
  );
}
