"use client";

import { useState, useEffect } from "react";
import { useAbraLayout } from "../abra-layout-provider";
import { Users, Plus, Shield, Mail, MoreVertical } from "lucide-react";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-500/10 text-red-400 border-red-500/30",
  ADMIN: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  MANAGER: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  MEDIA_BUYER: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  ASSISTANT: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEDIA_BUYER: "Media Buyer",
  ASSISTANT: "Assistant",
};

export default function TeamPage() {
  const { userRole } = useAbraLayout();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTeam() {
      try {
        const res = await fetch("/api/team");
        if (res.ok) {
          const data = await res.json();
          setTeam(data.users || data);
        }
      } catch (error) {
        console.error("Failed to fetch team:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeam();
  }, []);

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  if (!isAdmin && userRole !== "MANAGER") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Access Restricted</h2>
        <p className="text-slate-400">You don't have permission to view team members.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-slate-400">Manage team members and their roles</p>
        </div>
        {isAdmin && (
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition">
            <Plus className="w-4 h-4" />
            Invite Member
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      ) : team.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No Team Members</h2>
          <p className="text-slate-400">Start by inviting team members.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Member</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Last Login</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                        <span className="text-lg font-medium text-slate-400">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-white font-medium">{member.name}</div>
                        <div className="text-sm text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${ROLE_COLORS[member.role] || ROLE_COLORS.ASSISTANT}`}>
                      <Shield className="w-3 h-3" />
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                      member.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-slate-500/10 text-slate-400"
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {member.lastLoginAt
                      ? new Date(member.lastLoginAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button className="p-2 text-slate-400 hover:text-white transition">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
