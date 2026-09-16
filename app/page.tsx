"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  RefreshCw,
  Activity,
  CheckCircle2,
  ShieldAlert,
  Save,
  MessageSquare,
  Bot,
  Zap,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào! Em là **STOW** (Phiên bản Resilient Gateway Prototype).\n\nHệ thống này đã được tích hợp bộ lọc **Payload Sanitizer** (chống đơ khi chuyển đổi ngôn ngữ) và **SSE Heartbeat** (chống timeout khi tra cứu bảng giá). Anh/chị có thể thử các nút kịch bản bên dưới để kiểm tra tốc độ phản hồi!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [heartbeats, setHeartbeats] = useState(0);
  const [sanitizedParts, setSanitizedParts] = useState(0);
  const [emailLead, setEmailLead] = useState("");
  const [phoneLead, setPhoneLead] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendQuery = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: Message = {
      id: "user-" + Date.now(),
      role: "user",
      content: text,
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput("");
    setIsStreaming(true);
    setLatency(null);

    const startTime = performance.now();
    let firstTokenReceived = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      const assistantId = "asst-" + Date.now();

      // Placeholder assistant bubble
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith(": keep-alive")) {
            setHeartbeats((h) => h + 1);
            continue;
          }
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === "message-metadata") {
                setSanitizedParts(parsed.messageMetadata?.sanitizedCount || 0);
              } else if (parsed.type === "text-delta") {
                if (!firstTokenReceived) {
                  setLatency(Math.round(performance.now() - startTime));
                  firstTokenReceived = true;
                }
                assistantText += parsed.delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: assistantText } : m
                  )
                );
              }
            } catch {
              // Ignore partial JSON
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleTestFinding1 = async () => {
    // Automated Turn 1 -> Turn 2 sequence
    await sendQuery("Giới thiệu về MyStorage");
    setTimeout(() => {
      sendQuery("Tell me about your services");
    }, 1600);
  };

  const handleTestFinding2 = () => {
    sendQuery("Báo giá lưu trữ giúp em");
  };

  const handleTestFinding3 = () => {
    sendQuery("Tôi muốn đặt luôn một kho tự quản 2 CBM");
  };

  const handleSaveLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailLead || phoneLead) {
      setLeadSaved(true);
      setTimeout(() => setLeadSaved(false), 4000);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center py-6 px-4">
      {/* Header Container */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold shadow-md shadow-primary/20">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 text-lg">
                STOW Resilient Gateway
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                PROTOTYPE FIX
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Audit Fix for stow.mystorage.vn · Product Engineering Intern Challenge
            </p>
          </div>
        </div>

        {/* Real-time Diagnostics Bar */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            <span>TTFT:</span>
            <strong className="text-slate-900">
              {latency ? `${latency} ms` : "Standby"}
            </strong>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Heartbeats:</span>
            <strong className="text-slate-900">{heartbeats}</strong>
          </div>
          <div className="h-3 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span>Sanitizer:</span>
            <strong className="text-slate-900">Active</strong>
          </div>
        </div>
      </div>

      {/* Quick Test Scenarios Banner */}
      <div className="w-full max-w-4xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Kịch bản kiểm tra tự động (Audit Verification)
          </span>
          <span className="text-xs text-slate-500">Bấm để test trực tiếp các lỗi tìm được</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleTestFinding1}
            disabled={isStreaming}
            className="flex items-center justify-center gap-1.5 bg-white hover:bg-primary/5 hover:border-primary border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl transition shadow-sm disabled:opacity-50 text-left"
          >
            <span>⚡ Test Fix 1: Chuyển ngữ (Vi ➔ En)</span>
          </button>
          <button
            onClick={handleTestFinding2}
            disabled={isStreaming}
            className="flex items-center justify-center gap-1.5 bg-white hover:bg-primary/5 hover:border-primary border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl transition shadow-sm disabled:opacity-50 text-left"
          >
            <span>🏷️ Test Fix 2: Báo giá không bị treo</span>
          </button>
          <button
            onClick={handleTestFinding3}
            disabled={isStreaming}
            className="flex items-center justify-center gap-1.5 bg-white hover:bg-primary/5 hover:border-primary border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl transition shadow-sm disabled:opacity-50 text-left"
          >
            <span>🎯 Test Fix 3: Chốt đơn Slot-Filling</span>
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-full max-w-4xl flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden min-h-[500px] max-h-[620px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-800 border border-slate-200"
                }`}
              >
                {msg.content || (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Activity className="h-4 w-4 animate-spin" /> Đang truyền
                    dữ liệu...
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Lead Capture Interactive Card */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Save className="h-4 w-4 text-primary" />
            <span>Lưu bảng tính & Báo giá về Email:</span>
          </div>
          <form onSubmit={handleSaveLead} className="flex items-center gap-2">
            <input
              type="email"
              placeholder="Email của bạn..."
              value={emailLead}
              onChange={(e) => setEmailLead(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg font-medium transition"
            >
              {leadSaved ? "✓ Đã lưu Lead!" : "Lưu báo giá"}
            </button>
          </form>
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuery(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Hỏi STOW về kích thước, bảng giá hoặc đặt kho..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="h-10 w-10 rounded-xl bg-primary hover:bg-primary-dark text-white flex items-center justify-center disabled:opacity-40 transition shrink-0 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
