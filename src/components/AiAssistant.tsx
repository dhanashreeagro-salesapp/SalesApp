/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, MessageSquare, Send, Bot, Shield, Loader2, RefreshCw, X } from "lucide-react";
import { UserProfile } from "../types";
import { CompiledAnalytics } from "../utils/analytics";

interface AiAssistantProps {
  currentUser: UserProfile;
  analytics: CompiledAnalytics;
}

export default function AiAssistant({ currentUser, analytics }: AiAssistantProps) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    {
      role: "assistant",
      content: `Hello ${currentUser.name}! I am AgroSales IQ's AI Executive Assistant. I have indexed your unified multi-company sales records and salesperson targets up to May 26, 2026.
      
Ask me any deep strategic or tactical queries, such as:
1. "Which customers reduced purchases by more than 25%?"
2. "Which products are declining in Maharashtra?"
3. "Which salesperson has lowest budget achievement?"
4. "Which supplier grew fastest this year?"
5. "Which regions are underperforming?"`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of debate
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchAiResponse = async (userPrompt: string) => {
    if (!userPrompt.trim()) return;
    
    // Optimistic user update
    const updatedMessages = [...messages, { role: "user" as const, content: userPrompt }];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          contextData: {
            totalCurrentSales: analytics.currentYtdSales,
            growthPercent: analytics.growthPercent,
            regions: analytics.regionPerformances,
            salespersons: analytics.salespersonRankings,
            droppedCustomers: analytics.droppedCustomers,
            decliningProductsVal: analytics.decliningProductsVal,
            newCustomers: analytics.newCustomers,
            lostCustomers: analytics.lostCustomers,
          }
        })
      });

      if (!response.ok) throw new Error("API Route return error");
      const resJson = await response.json();
      
      setMessages([...updatedMessages, { role: "assistant" as const, content: resJson.text }]);
    } catch (err: any) {
      setMessages([...updatedMessages, {
        role: "assistant" as const,
        content: `Sorry, there was an issue querying the Gemini AI intelligence suite: ${err.message || "Please make sure your API keys and dev server are initialized."}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: `Database index synchronized. Ask me anything about multi-company invoice lines matching your hierarchy profile (${currentUser.role}).`
      }
    ]);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col h-[520px]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-900">AI Sales Insights Advisor</h3>
            <p className="text-[10px] text-gray-500 font-medium">Powered by Gemini 3.5-flash with Grounded CRM Index</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="text-gray-400 hover:text-gray-900 p-1 rounded-md hover:bg-gray-100 transition"
          title="Clear dialog logs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex gap-3 max-w-4xl ${m.role === "user" ? "justify-end ml-10" : "mr-10"}`}>
            {m.role !== "user" && (
              <div className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-xs shrink-0 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div className={`p-4 rounded-xl text-xs leading-relaxed ${
              m.role === "user" 
                ? "bg-green-600 text-white font-medium" 
                : "bg-gray-150 border border-gray-100 text-gray-800"
            }`}>
              {/* Process simple markdown newline spacing */}
              <div className="whitespace-pre-line space-y-1">
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 items-center text-gray-400 text-xs py-2">
            <Loader2 className="w-4 h-4 animate-spin text-green-600" />
            <span>Scanning spreadsheets and compiling strategic commentary...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggested Fast Tags */}
      <div className="px-6 py-2 border-t border-gray-100 bg-gray-50/20 flex flex-wrap gap-2">
        <button
          onClick={() => fetchAiResponse("Which customers reduced purchases by more than 25%?")}
          disabled={isLoading}
          className="text-[10px] bg-white border border-gray-100 rounded-md py-1 px-2.5 text-gray-600 hover:border-green-600 hover:text-green-600 transition truncate max-w-xs"
        >
          -25% Dropped Dealers?
        </button>
        <button
          onClick={() => fetchAiResponse("Which products are declining in Maharashtra?")}
          disabled={isLoading}
          className="text-[10px] bg-white border border-gray-100 rounded-md py-1 px-2.5 text-gray-600 hover:border-green-600 hover:text-green-600 transition truncate max-w-xs"
        >
          Maharashtra Declining Brands?
        </button>
        <button
          onClick={() => fetchAiResponse("Which salesperson has lowest budget achievement?")}
          disabled={isLoading}
          className="text-[10px] bg-white border border-gray-100 rounded-md py-1 px-2.5 text-gray-600 hover:border-green-600 hover:text-green-600 transition truncate max-w-xs"
        >
          Lowest Target Achiever?
        </button>
      </div>

      {/* Input box */}
      <form
        onSubmit={(e) => { e.preventDefault(); fetchAiResponse(input); }}
        className="p-4 border-t border-gray-50 flex items-center gap-3 bg-white rounded-b-2xl"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask AI Advisor about region growths, shortfall metrics or risk spots...`}
          disabled={isLoading}
          className="flex-1 bg-gray-150 border border-gray-200 focus:outline-none focus:border-green-600 px-4 py-2.5 rounded-xl text-xs placeholder:text-gray-400 transition"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2.5 bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-150 disabled:text-gray-400 rounded-xl transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
