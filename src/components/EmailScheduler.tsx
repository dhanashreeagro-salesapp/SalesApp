/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Mail, Clock, Calendar, CheckSquare, RefreshCw, Send, Eye, FileText, Download, Check, AlertCircle } from "lucide-react";
import { EmailLog, UserProfile } from "../types";
import { CompiledAnalytics } from "../utils/analytics";

interface EmailSchedulerProps {
  emailLogs: EmailLog[];
  onTriggerSimulate: () => void;
  currentUser: UserProfile;
  isSimulating: boolean;
  analytics: CompiledAnalytics;
}

export default function EmailScheduler({
  emailLogs,
  onTriggerSimulate,
  currentUser,
  isSimulating,
  analytics,
}: EmailSchedulerProps) {
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [schedulerConfig, setSchedulerConfig] = useState({
    active: true,
    dayOfMonth: 3,
    hour: 8,
    recipientsCount: 3,
  });

  const [notification, setNotification] = useState<string | null>(null);

  const triggerCampaign = async () => {
    onTriggerSimulate();
    setNotification("Automated campaign trigger sent! Recharts statistics and customized emails compiled successfully.");
    setTimeout(() => setNotification(null), 6000);
  };

  const downloadAttachmentMock = (fileName: string) => {
    setNotification(`Mock download started for binary attachment: ${fileName}`);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Scheduler Dashboard Intro */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-xl font-medium tracking-tight text-gray-900">
              Monthly Automated Reporting Campaign
            </h2>
          </div>
          <p className="text-xs text-gray-500 max-w-2xl">
            AgroSales IQ dispatches personalized HTML performance scorecards, trend indices, and target variance reports 
            on the 3rd of every month to sales staff based on corporate parent-child reporting hierarchies.
          </p>
        </div>
        <button
          onClick={triggerCampaign}
          disabled={isSimulating}
          className="px-4 py-2.5 bg-green-600 border border-green-700 hover:bg-green-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0"
        >
          {isSimulating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Trigger simulation now
        </button>
      </div>

      {notification && (
        <div className="bg-green-50 border border-green-150 text-green-900 p-4 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Campaign Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Scheduler Rules */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs lg:col-span-1 space-y-6">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            Scheduler Controls
          </h3>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50/50">
              <span className="font-semibold text-gray-700">Campaign Active Status</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={schedulerConfig.active}
                  onChange={(e) => setSchedulerConfig({ ...schedulerConfig, active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600" />
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                Target Calendar Rule
              </label>
              <div className="p-3 border border-gray-150 rounded-xl bg-white flex items-center justify-between">
                <span>Month Dispatches Calendar:</span>
                <span className="font-semibold text-gray-900">3rd of Month</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                Target Hour UTC
              </label>
              <div className="p-3 border border-gray-150 rounded-xl bg-white flex items-center justify-between">
                <span>Time of Dispatch:</span>
                <span className="font-semibold text-gray-900">08:00 AM</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="text-[10px] text-gray-500">
                Dispatched emails are structured differently for each tier:
              </div>
              <ul className="text-[10px] text-gray-600 space-y-2 list-inside list-disc">
                <li><strong className="text-gray-900">Salesperson:</strong> Individual territory summaries, target achievements vs actuals, customer growth/declines list.</li>
                <li><strong className="text-gray-900">Regional Manager:</strong> Overlooking entire team ranks, territory matrices, AI summaries.</li>
                <li><strong className="text-gray-900">Sales Director:</strong> Company-wide gross net sales, supplier percentages, top risks.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Dispatch Log Queue Queue */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs lg:col-span-2 space-y-4">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            Sent Campaign Logs ({emailLogs.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-[10px] uppercase font-semibold">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Recipient</th>
                  <th className="py-2.5">Role</th>
                  <th className="py-2.5">Subject Preview</th>
                  <th className="py-2.5">Attachments</th>
                  <th className="py-2.5 text-right">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {emailLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="py-3 font-medium text-gray-900">
                      {new Date(log.dateSent).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit" })}
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-gray-800">{log.recipientName}</div>
                      <div className="text-[10px] text-gray-500">{log.recipientEmail}</div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                        log.recipientRole === "Sales Director" ? "bg-purple-50 text-purple-700" :
                        log.recipientRole === "Regional Manager" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {log.recipientRole}
                      </span>
                    </td>
                    <td className="py-3 max-w-xs truncate text-[11px]" title={log.subject}>
                      {log.subject}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        {log.attachments.map((file, fIdx) => (
                          <button
                            key={fIdx}
                            onClick={() => downloadAttachmentMock(file)}
                            className="text-[10px] text-gray-500 hover:text-green-600 flex items-center gap-1 font-medium transition text-left"
                          >
                            <Download className="w-3 h-3 text-gray-400 shrink-0" />
                            {file}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1 text-gray-500 hover:text-green-600 rounded-md hover:bg-gray-100 transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Pop-Up Modal For Detailed Report Preview */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Consolidated HTML Email Preview</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Dispatched to {selectedLog.recipientName} ({selectedLog.recipientRole})</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition"
              >
                ✖ close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 border border-gray-150 rounded-xl bg-gray-50">
              <div className="bg-white p-6 rounded-lg shadow-xs border border-gray-100 font-sans">
                <div className="border-b border-gray-100 pb-4 mb-4">
                  <div className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">Mailing Header Meta</div>
                  <div className="text-xs text-gray-800 mt-1"><strong>To:</strong> {selectedLog.recipientName} &lt;{selectedLog.recipientEmail}&gt;</div>
                  <div className="text-xs text-gray-800 mt-1"><strong>Subject:</strong> {selectedLog.subject}</div>
                </div>
                {/* Embedded Simulated HTML template style */}
                <div 
                  className="prose prose-xs max-w-none text-gray-800 leading-relaxed text-xs space-y-4"
                  dangerouslySetInnerHTML={{ __html: selectedLog.bodyPreview }} 
                />
              </div>
            </div>

            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span>Simulated delivery format: HTML standard + inline CSS.</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadAttachmentMock(selectedLog.attachments[0])}
                  className="px-3 py-1.5 bg-white border border-gray-150 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition flex items-center gap-1 text-[11px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF Summary
                </button>
                <button
                  onClick={() => downloadAttachmentMock("Variance_Data.xlsx")}
                  className="px-3 py-1.5 bg-white border border-gray-150 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition flex items-center gap-1 text-[11px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
