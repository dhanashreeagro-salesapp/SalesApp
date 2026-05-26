/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, Shield, Terminal, Library, AlertCircle, RefreshCw, Layers, CheckCircle } from "lucide-react";
import { AuditLog, UserProfile } from "../types";

interface AdminSettingsProps {
  auditLogs: AuditLog[];
  onResetDatabase: () => void;
  currentUser: UserProfile;
}

export default function AdminSettings({
  auditLogs,
  onResetDatabase,
  currentUser,
}: AdminSettingsProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const triggerReset = () => {
    onResetDatabase();
    setSuccessMsg("System successfully restored to production master seed data (Company A & B + Budgets).");
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const standardSpellings = [
    { original: "pune fert", standardized: "Mahalaxmi Fertilizers Pune" },
    { original: "balaji satara", standardized: "Balaji Agro Services Satara" },
    { original: "krishna agency nasik", standardized: "Krishna Agro Agency Nashik" },
    { original: "malhar seeds", standardized: "Jai Malhar Seeds Kolhapur" },
    { original: "saraswathi solapur", standardized: "Saraswati Agro Solapur" },
    { original: "SugaMax Bio Boost", standardized: "SugaMax Bio Enhancer" },
    { original: "rhizo active", standardized: "RhizoActive Soil Pro" },
  ];

  return (
    <div className="space-y-6">
      
      {/* Intro */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
        <h2 className="text-xl font-medium tracking-tight text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          Admin & Standardisation Settings
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          System operational configurations and brand mapping tables. System automatically maps irregular name entries from raw Excel invoice line items to production clean brand standardizations below.
        </p>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-150 text-green-900 p-4 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Spelling standardisation dictionary mapping tables */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs md:col-span-1 space-y-4">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Library className="w-4 h-4 text-gray-400" />
            Brand spelling mapping indices
          </h3>

          <div className="space-y-3">
            <div className="text-[10px] text-gray-500">
              Matches irregular spreadsheet names (e.g., from small local franchise agents) and resolves duplicates during upload:
            </div>
            <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
              {standardSpellings.map((sp, idx) => (
                <div key={idx} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl text-[10px] flex justify-between items-center">
                  <div>
                    <span className="text-gray-450 uppercase font-semibold">Incoming:</span>
                    <div className="font-bold text-red-500 mt-0.5">"{sp.original}"</div>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-450 uppercase font-semibold">Map to:</span>
                    <div className="font-bold text-green-600 mt-0.5">"{sp.standardized.split(" ")[0]}..."</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Audit logging trail */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs md:col-span-2 space-y-4">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-400" />
            System Transactional Audit Trail
          </h3>

          <div className="overflow-x-auto">
            <div className="max-h-[350px] overflow-y-auto">
              <table className="w-full text-[11px] text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase text-[9px] font-semibold">
                    <th className="py-2">Time</th>
                    <th className="py-2">Initiator</th>
                    <th className="py-2">Action</th>
                    <th className="py-2">Details Summary</th>
                    <th className="py-2 text-right">Maturity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700">
                  {auditLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/30">
                      <td className="py-2.5 font-medium text-gray-400 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 font-bold">{log.user}</td>
                      <td className="py-2.5 text-gray-900 font-semibold">{log.action}</td>
                      <td className="py-2.5 max-w-[200px] truncate" title={log.details}>
                        {log.details}
                      </td>
                      <td className="py-2.5 text-right font-semibold">
                        <span className={`px-2 py-0.5 rounded-full text-[8.5px] ${
                          log.status === "Success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Extreme administrative resets block */}
      <div className="p-6 bg-red-50/50 rounded-2xl border border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h4 className="text-xs font-bold text-red-900 flex items-center gap-1.5 uppercase tracking-wider">
            Danger Operations Zone
          </h4>
          <p className="text-[10px] text-red-700 mt-1 max-w-xl leading-relaxed">
            Restoring standard seed database removes any custom spreadsheet invoice records uploaded during live execution session, returning parameters to pre-existing standard regional balances.
          </p>
        </div>
        <button
          onClick={triggerReset}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Factory Format Reset
        </button>
      </div>

    </div>
  );
}
