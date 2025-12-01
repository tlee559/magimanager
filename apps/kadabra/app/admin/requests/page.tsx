"use client";

import { useState, useEffect } from "react";
import { RequestsView, RequestModal, type AccountRequest } from "@/lib/kadabra-ui";

export default function RequestsPage() {
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : data.requests || []);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRequest(justification: string) {
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CREATE_NEW", justification }),
      });
      if (res.ok) {
        setShowRequestModal(false);
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to create request:", error);
    }
  }

  return (
    <>
      <RequestsView
        requests={requests}
        loading={loading}
        onCreateRequest={() => setShowRequestModal(true)}
      />

      {showRequestModal && (
        <RequestModal
          onClose={() => setShowRequestModal(false)}
          onSubmit={handleCreateRequest}
        />
      )}
    </>
  );
}
