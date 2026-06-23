import React, { useState, useMemo } from "react";
import { AuditLog } from "../types";
import { 
  Terminal, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  User, 
  Clock, 
  Trash2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Database
} from "lucide-react";

interface AuditLogsViewProps {
  auditLogs: AuditLog[];
  onResetDatabase?: () => void;
  currentUser?: { role: string };
}

export default function AuditLogsView({ auditLogs, onResetDatabase, currentUser }: AuditLogsViewProps) {
  // Filters & Page state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [initiatorFilter, setInitiatorFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Aggregate user initiator list
  const initiators = useMemo(() => {
    const list = new Set(auditLogs.map(log => log.user).filter(Boolean));
    return Array.from(list).sort();
  }, [auditLogs]);

  // Aggregate counters
  const counters = useMemo(() => {
    let success = 0;
    let warning = 0;
    let error = 0;
    auditLogs.forEach(l => {
      if (l.status === "Success") success++;
      else if (l.status === "Warning") warning++;
      else if (l.status === "Error") error++;
    });
    return { success, warning, error, total: auditLogs.length };
  }, [auditLogs]);

  // Query Match filtering
  const filteredLogs = useMemo(() => {
    let result = [...auditLogs];

    // Status matching
    if (statusFilter !== "All") {
      result = result.filter(l => l.status === statusFilter);
    }

    // User/Initiator matching
    if (initiatorFilter !== "All") {
      result = result.filter(l => l.user === initiatorFilter);
    }

    // Text search phrase
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        l =>
          (l.action && l.action.toLowerCase().includes(q)) ||
          (l.details && l.details.toLowerCase().includes(q)) ||
          (l.user && l.user.toLowerCase().includes(q))
      );
    }

    // Newest logs first
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, statusFilter, initiatorFilter, searchTerm]);

  // Pagination bounds
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, initiatorFilter]);

  return (
    <div className="space-y-6">

      {/* Page header banner with system status info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-left space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#ea580c] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Security & Transaction auditing logs
          </span>
          <h1 className="text-lg lg:text-xl font-bold font-sans text-gray-900 tracking-tight">
            System Compliance Audit Trail
          </h1>
          <p className="text-[11px] text-gray-500">
            Real-time automated logging. Tracks live Excel workbook uploads, data duplicate merges, user registrations, and dashboard scoped filters.
          </p>
        </div>

        {currentUser?.role === "Admin" && onResetDatabase && (
          <button
            onClick={() => {
              if (window.confirm("Restore default starting database state? This action will remove all custom user Excel files uploaded in this session.")) {
                onResetDatabase();
              }
            }}
            className="px-3.5 py-1.5 border border-red-255 hover:bg-red-50 text-red-600 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Restore Database To Seed Data
          </button>
        )}
      </div>

      {/* KPI status metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-150 p-4 rounded-xl text-left space-y-2 shadow-2xs">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">🏢 Total Operations</span>
          <p className="text-lg font-black text-gray-900">{counters.total}</p>
          <div className="text-[9px] text-gray-500 font-mono">Continuous tracking</div>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-xl text-left space-y-2 shadow-2xs">
          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>Success Rate</span>
          </div>
          <p className="text-lg font-black text-green-600">
            {counters.success}{" "}
            <span className="text-xs font-normal text-gray-400">
              ({counters.total > 0 ? ((counters.success / counters.total) * 100).toFixed(0) : "100"}%)
            </span>
          </p>
          <div className="text-[9px] text-gray-500 font-mono">No exceptions thrown</div>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-xl text-left space-y-2 shadow-2xs">
          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Warnings Flagged</span>
          </div>
          <p className="text-lg font-black text-amber-600">{counters.warning}</p>
          <div className="text-[9px] text-gray-500 font-mono">User authentication delays</div>
        </div>

        <div className="bg-white border border-gray-150 p-4 rounded-xl text-left space-y-2 shadow-2xs">
          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
            <XCircle className="w-3 h-3 text-red-500" />
            <span>System Exceptions</span>
          </div>
          <p className="text-lg font-black text-red-600">{counters.error}</p>
          <div className="text-[9px] text-gray-500 font-mono">Database write errors</div>
        </div>
      </div>

      {/* Query Search / Filter Controls header */}
      <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-2xs flex flex-wrap items-center gap-4">
        
        {/* Keywords text Search */}
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search matching logs or transaction details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-700 focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition"
          />
        </div>

        {/* Status Badge options */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Filter className="w-3 h-3" /> Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            <option value="All">All Operations</option>
            <option value="Success">Success</option>
            <option value="Warning">Warning</option>
            <option value="Error">Error</option>
          </select>
        </div>

        {/* User Initiator select */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <User className="w-3 h-3" /> Initiator:
          </span>
          <select
            value={initiatorFilter}
            onChange={(e) => setInitiatorFilter(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-2 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            <option value="All">All Users</option>
            {initiators.map((user, idx) => (
              <option key={idx} value={user}>{user}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Terminal Logging Table render matches */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-2xs overflow-hidden text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4 min-w-[130px]">System Timestamp</th>
                <th className="py-3 px-4">Initiating Agent</th>
                <th className="py-3 px-4">Transactional Action</th>
                <th className="py-3 px-4">Payload/Mutation Details Summary</th>
                <th className="py-3 px-4 text-center">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 font-mono text-gray-400 text-[10px]">
                      <div className="flex items-center gap-1.5 font-semibold text-gray-550">
                        <Clock className="w-3.5 h-3.5 text-gray-400 mr-0.5" />
                        {new Date(log.timestamp).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short"
                        })}{" "}
                        {new Date(log.timestamp).toLocaleTimeString("en-IN")}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-gray-900 leading-none">
                      {log.user || "System Daemon"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-gray-900 block">{log.action}</span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[380px] break-words text-gray-600 leading-relaxed font-medium">
                      {log.details}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold ${
                        log.status === "Success" 
                          ? "bg-green-50 text-green-700" 
                          : log.status === "Warning"
                          ? "bg-amber-50 text-[#b45309]"
                          : "bg-red-50 text-red-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          log.status === "Success" 
                            ? "bg-green-500" 
                            : log.status === "Warning"
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`} />
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <div className="space-y-1">
                      <Terminal className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="font-bold text-xs text-gray-500">No compliance logs matching query</p>
                      <p className="text-[10px] text-gray-400">Try relaxing your search terms or changing your user filter constraints.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between font-semibold text-gray-500 text-xs">
            <div>
              Showing logs <span className="font-bold text-gray-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
              <span className="font-bold text-gray-800">{Math.min(filteredLogs.length, currentPage * itemsPerPage)}</span> of{" "}
              <span className="font-bold text-gray-800">{filteredLogs.length}</span> security entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 transition cursor-pointer ${
                  currentPage === 1 ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-gray-700 font-bold">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 transition cursor-pointer ${
                  currentPage === totalPages ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
