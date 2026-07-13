/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, MessageSquare, Send, Bot, Shield, Loader2, RefreshCw, X, Mic } from "lucide-react";
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
      content: `Hello ${currentUser.name}! I am Dhanashree AgriPulse's AI Executive Assistant. I have indexed your unified multi-company sales records and salesperson targets up to May 26, 2026.
      
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
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
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
          currentUser: {
            name: currentUser.name,
            role: currentUser.role,
            email: currentUser.email
          },
          contextData: {
            totalCurrentSales: analytics.currentYtdSales,
            growthPercent: analytics.growthPercent,
            regions: analytics.regionPerformances,
            salespersons: analytics.salespersonRankings,
            droppedCustomers: analytics.droppedCustomers,
            decliningProductsVal: analytics.decliningProductsVal,
            newCustomers: analytics.newCustomers,
            lostCustomers: analytics.lostCustomers,
            productMonthlyComparisons: analytics.productMonthlyComparisons,
          }
        })
      });

      if (!response.ok) {
        let errMsg = `Server returned status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg += `: ${errData.error}`;
          } else if (errData && errData.message) {
            errMsg += `: ${errData.message}`;
          }
        } catch (_) {
          try {
            const text = await response.text();
            if (text) errMsg += `: ${text.slice(0, 150)}`;
          } catch (_) {}
        }
        throw new Error(errMsg);
      }
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

  // Simulated Voice Dictation (Voice Input Readiness)
  const triggerVoiceInput = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    
    // Check for native webkitSpeechRecognition API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this iframe environment or current browser tab. Ready and wired to standard browser voice recognition frameworks!");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = "en-IN";
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setInput(text);
        }
        setIsListening(false);
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-xs flex flex-col h-[480px] sm:h-[520px] md:h-[600px] lg:h-[660px] overflow-hidden">
      
      {/* Header */}
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-150 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/40 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-bold text-gray-950 dark:text-slate-100">AI Sales Insights Advisor</h3>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Powered by Gemini flash with Grounded CRM Index</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="text-gray-400 hover:text-gray-900 dark:text-slate-500 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Clear conversational logs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex gap-2.5 md:gap-3 max-w-4xl ${m.role === "user" ? "justify-end pl-6 sm:pl-20" : "pr-6 sm:pr-20"}`}>
            {m.role !== "user" && (
              <div className="w-7 h-7 bg-green-600 dark:bg-green-700 text-white rounded-full flex items-center justify-center text-xs shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div className={`p-3 md:p-4 rounded-xl text-xs leading-relaxed text-left ${
              m.role === "user" 
                ? "bg-green-600 text-white font-medium shadow-3xs" 
                : "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-150/40 dark:border-slate-700/50"
            }`}>
              {/* Process simple markdown newline spacing */}
              <div className="whitespace-pre-line space-y-1 font-sans">
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2.5 items-center text-gray-400 dark:text-slate-500 text-xs py-2 text-left">
            <Loader2 className="w-4 h-4 animate-spin text-green-600 dark:text-green-400" />
            <span>Scanning spreadsheets and compiling strategic commentary...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggested Fast Tags */}
      <div className="px-4 py-2 md:px-6 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/20 dark:bg-slate-950/20 flex flex-wrap gap-1.5 justify-start">
        <button
          onClick={() => fetchAiResponse("Which customers reduced purchases by more than 25%?")}
          disabled={isLoading}
          className="text-[9px] md:text-[10px] bg-white dark:bg-slate-800 border border-gray-150 dark:border-slate-700 rounded-lg py-1 px-2.5 text-gray-600 dark:text-slate-350 hover:border-green-600 dark:hover:border-green-500 hover:text-green-600 dark:hover:text-green-450 transition truncate max-w-xs cursor-pointer"
        >
          -25% Dropped Dealers?
        </button>
        <button
          onClick={() => fetchAiResponse("Which products are declining in Maharashtra?")}
          disabled={isLoading}
          className="text-[9px] md:text-[10px] bg-white dark:bg-slate-800 border border-gray-150 dark:border-slate-700 rounded-lg py-1 px-2.5 text-gray-600 dark:text-slate-350 hover:border-green-600 dark:hover:border-green-500 hover:text-green-600 dark:hover:text-green-450 transition truncate max-w-xs cursor-pointer"
        >
          Maharashtra Declining Brands?
        </button>
        <button
          onClick={() => fetchAiResponse("Which salesperson has lowest budget achievement?")}
          disabled={isLoading}
          className="text-[9px] md:text-[10px] bg-white dark:bg-slate-800 border border-gray-150 dark:border-slate-700 rounded-lg py-1 px-2.5 text-gray-600 dark:text-slate-350 hover:border-green-600 dark:hover:border-green-500 hover:text-green-600 dark:hover:text-green-450 transition truncate max-w-xs cursor-pointer"
        >
          Lowest Target Achiever?
        </button>
      </div>

      {/* Input box */}
      <form
        onSubmit={(e) => { e.preventDefault(); fetchAiResponse(input); }}
        className="p-3 md:p-4 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2 md:gap-3 bg-white dark:bg-slate-900 rounded-b-2xl"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask AI Advisor about region growths, shortfalls, or dealers...`}
          disabled={isLoading}
          className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:outline-none focus:border-green-600 dark:focus:border-green-500 px-3 py-2 md:px-4 md:py-2.5 rounded-xl text-xs md:text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 transition"
        />
        
        {/* Voice Trigger Button */}
        <button
          type="button"
          onClick={triggerVoiceInput}
          title="Dictate with voice input"
          disabled={isLoading}
          className={`p-2.5 rounded-xl border border-gray-200 dark:border-slate-750 transition flex items-center justify-center cursor-pointer ${
            isListening 
              ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-300 animate-pulse" 
              : "bg-gray-50 dark:bg-slate-800 text-gray-650 dark:text-slate-350 hover:bg-gray-100 dark:hover:bg-slate-700"
          }`}
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2.5 md:p-3 bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 rounded-xl transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
