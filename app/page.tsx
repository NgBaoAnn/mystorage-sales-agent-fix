"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Zap,
  CheckCircle2,
  ShieldAlert,
  Bot,
  Package,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  CreditCard,
  Phone,
  User,
} from "lucide-react";

interface StorageUnit {
  id: string;
  name: string;
  dim: string;
  price: string;
  fit: string;
  popular?: boolean;
}

interface ServiceCard {
  id: string;
  name: string;
  desc: string;
  price: string;
  tag: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: {
    type: "storage_units" | "service_cards" | "booking_slot_filling";
    units?: StorageUnit[];
    services?: ServiceCard[];
    customerName?: string;
    customerPhone?: string;
    unitSuggested?: string;
    basePrice?: number;
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào anh An! Em là **STOW** (Phiên bản Resilient Gateway Prototype của MyStorage).\n\nEm được trang bị bộ lọc **Payload Sanitizer** (chống lỗi nghẽn context khi chuyển đổi ngôn ngữ) và **SSE Heartbeat Keep-Alive** (phản hồi bảng giá tức thì < 300ms, không bị treo 45s).\n\nAnh An cần tham khảo bảng giá kho máy lạnh, ước tính thể tích (CBM) hay muốn đặt kho giữ chỗ ngay ạ?",
      cards: {
        type: "storage_units",
        units: [
          {
            id: "u1",
            name: "Locker Mini 1 CBM",
            dim: "1.0m x 1.0m x 1.0m",
            price: "559.000đ/tháng",
            fit: "Vali du lịch, 4–6 thùng đồ cá nhân",
            popular: false,
          },
          {
            id: "u2",
            name: "Kho Tiêu chuẩn 3 CBM",
            dim: "1.5m x 1.0m x 2.0m",
            price: "1.250.000đ/tháng",
            fit: "Đồ phòng trọ, xe máy, tủ lạnh mini",
            popular: true,
          },
          {
            id: "u3",
            name: "Kho Căn hộ 6 CBM",
            dim: "2.0m x 1.5m x 2.0m",
            price: "2.190.000đ/tháng",
            fit: "Nội thất căn hộ 1 phòng ngủ, bàn ghế",
            popular: false,
          },
        ],
      },
    },
  ]);

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [heartbeats, setHeartbeats] = useState(0);
  const [sanitizedCount, setSanitizedCount] = useState(0);

  // In-chat booking widget state
  const [moveInDate, setMoveInDate] = useState("2026-09-20");
  const [rentalMonths, setRentalMonths] = useState(3);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingRef, setBookingRef] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

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
      let parsedCardData: any = null;
      const assistantId = "asst-" + Date.now();

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
                setSanitizedCount(parsed.messageMetadata?.sanitizedCount || 0);
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
              } else if (parsed.type === "data-service-cards") {
                parsedCardData = parsed.data;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, cards: parsedCardData } : m
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
    await sendQuery("Giới thiệu về MyStorage");
    setTimeout(() => {
      sendQuery("Tell me about your services");
    }, 1500);
  };

  const handleTestFinding2 = () => {
    sendQuery("Báo giá lưu trữ giúp em");
  };

  const handleTestFinding3 = () => {
    sendQuery("Tôi muốn đặt luôn một kho tự quản 2 CBM");
  };

  const handleSelectUnit = (unit: StorageUnit) => {
    sendQuery(`Tôi muốn chọn ${unit.name} (${unit.dim}) với giá ${unit.price}, hỗ trợ tôi đặt kho.`);
  };

  const handleConfirmBooking = () => {
    const randomRef = "MST-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setBookingRef(randomRef);
    setBookingConfirmed(true);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center">
      {/* Top Brand Bar */}
      <header className="w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur sticky top-0 z-20 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#0275BC] to-sky-400 flex items-center justify-center text-white font-black shadow-lg shadow-[#0275BC]/30">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">
                  MyStorage STOW
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Resilient Gateway
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Audit Fix for stow.mystorage.vn · Product Engineering Intern Challenge
              </p>
            </div>
          </div>

          {/* Real-time Diagnostics HUD */}
          <div className="flex items-center gap-3 text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 shadow-inner">
            <div className="flex items-center gap-1.5" title="Time to first token">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-slate-400">TTFT:</span>
              <span className="font-semibold text-white">
                {latency ? `${latency}ms` : "< 300ms"}
              </span>
            </div>

            <div className="h-3 w-px bg-slate-800" />

            <div className="flex items-center gap-1.5" title="SSE Keep-alive pings">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-400">Heartbeats:</span>
              <span className="font-semibold text-emerald-400">{heartbeats}</span>
            </div>

            <div className="h-3 w-px bg-slate-800" />

            <div className="flex items-center gap-1.5" title="Payload Sanitizer">
              <ShieldAlert className="h-3.5 w-3.5 text-sky-400" />
              <span className="text-slate-400">Sanitizer:</span>
              <span className="font-semibold text-sky-400">Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-4xl flex-1 flex flex-col py-4 px-3 sm:px-4">
        {/* Test Scenarios Banner */}
        <div className="mb-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> 1-Click Audit Verification Toolbar
            </span>
            <span className="text-[11px] text-slate-400">
              Nhấn để kiểm tra giải pháp cho các lỗi tìm được
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handleTestFinding1}
              disabled={isStreaming}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/50 text-left transition disabled:opacity-40 group"
            >
              <div>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  ⚡ Fix 1: Chuyển ngữ (Vi ➔ En)
                </div>
                <div className="text-[11px] text-slate-400">Lọc sạch UI parts, không đơ 45s</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-sky-400 transition" />
            </button>

            <button
              onClick={handleTestFinding2}
              disabled={isStreaming}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-left transition disabled:opacity-40 group"
            >
              <div>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  🏷️ Fix 2: Báo giá tức thì
                </div>
                <div className="text-[11px] text-slate-400">SSE keep-alive & fallback llms.txt</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 transition" />
            </button>

            <button
              onClick={handleTestFinding3}
              disabled={isStreaming}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 text-left transition disabled:opacity-40 group"
            >
              <div>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  🎯 Fix 3: Quy trình "Đặt luôn"
                </div>
                <div className="text-[11px] text-slate-400">In-chat slot-filling không văng form</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 transition" />
            </button>
          </div>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 bg-slate-950/70 border border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden min-h-[460px] max-h-[640px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-xl bg-[#0275BC] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#0275BC]/20">
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div className="max-w-[90%] sm:max-w-[82%] space-y-3">
                  {/* Bubble Text */}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[#0275BC] text-white rounded-br-none shadow-md shadow-[#0275BC]/25"
                        : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm"
                    }`}
                  >
                    {msg.content || (
                      <span className="flex items-center gap-2 text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                        Đang truyền dữ liệu qua Resilient Gateway...
                      </span>
                    )}
                  </div>

                  {/* Interactive Storage Units Cards */}
                  {msg.cards?.type === "storage_units" && msg.cards.units && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      {msg.cards.units.map((unit) => (
                        <div
                          key={unit.id}
                          className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                            unit.popular
                              ? "bg-gradient-to-b from-sky-950/40 to-slate-900 border-sky-500/60 shadow-lg shadow-sky-500/10"
                              : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            {unit.popular && (
                              <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-sky-500 text-white px-2 py-0.5 rounded-full mb-1.5">
                                Phổ biến nhất
                              </span>
                            )}
                            <h4 className="text-xs font-bold text-white mb-0.5">
                              {unit.name}
                            </h4>
                            <div className="text-xs text-sky-400 font-semibold mb-1">
                              {unit.price}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1.5">
                              <Package className="h-3 w-3 text-slate-500" />
                              {unit.dim}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-snug mb-3">
                              {unit.fit}
                            </p>
                          </div>
                          <button
                            onClick={() => handleSelectUnit(unit)}
                            disabled={isStreaming}
                            className="w-full py-1.5 px-2 bg-slate-800 hover:bg-[#0275BC] text-slate-200 hover:text-white text-xs font-medium rounded-lg border border-slate-700 hover:border-sky-400 transition flex items-center justify-center gap-1"
                          >
                            <span>Chọn kích thước này</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interactive Service Cards */}
                  {msg.cards?.type === "service_cards" && msg.cards.services && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {msg.cards.services.map((svc) => (
                        <div
                          key={svc.id}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/40 transition"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-white">
                              {svc.name}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-sky-400 px-1.5 py-0.5 rounded border border-slate-700">
                              {svc.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mb-2">
                            {svc.desc}
                          </p>
                          <div className="text-xs font-semibold text-amber-400">
                            {svc.price}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interactive Booking Widget */}
                  {msg.cards?.type === "booking_slot_filling" && (
                    <div className="bg-slate-900 border border-sky-500/40 rounded-2xl p-4 shadow-xl">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-sky-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            Xác nhận thông tin Giữ kho (Booking Card)
                          </h4>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          In-Chat Checkout
                        </span>
                      </div>

                      {!bookingConfirmed ? (
                        <div className="space-y-3 text-xs">
                          {/* Customer info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <User className="h-3.5 w-3.5 text-slate-500" />
                              <span>Khách hàng:</span>
                              <strong className="text-white">Anh An</strong>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Phone className="h-3.5 w-3.5 text-slate-500" />
                              <span>SĐT:</span>
                              <strong className="text-white">0936203020</strong>
                            </div>
                          </div>

                          {/* Progressive slot-filling inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-slate-400 font-medium mb-1 flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-sky-400" />
                                Ngày dọn vào kho:
                              </label>
                              <input
                                type="date"
                                value={moveInDate}
                                onChange={(e) => setMoveInDate(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-sky-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-400 font-medium mb-1 flex items-center gap-1">
                                <Clock className="h-3 w-3 text-sky-400" />
                                Thời gian thuê:
                              </label>
                              <select
                                value={rentalMonths}
                                onChange={(e) => setRentalMonths(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-sky-500"
                              >
                                <option value={1}>1 tháng (950.000đ)</option>
                                <option value={3}>3 tháng (-5% ưu đãi)</option>
                                <option value={6}>6 tháng (-10% ưu đãi)</option>
                                <option value={12}>12 tháng (-15% ưu đãi)</option>
                              </select>
                            </div>
                          </div>

                          {/* Total Estimation */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                            <span className="text-slate-400">Tạm tính:</span>
                            <span className="text-sm font-bold text-sky-400">
                              {(
                                950000 *
                                rentalMonths *
                                (rentalMonths >= 12
                                  ? 0.85
                                  : rentalMonths >= 6
                                  ? 0.9
                                  : rentalMonths >= 3
                                  ? 0.95
                                  : 1)
                              ).toLocaleString("vi-VN")}{" "}
                              VNĐ
                            </span>
                          </div>

                          <button
                            onClick={handleConfirmBooking}
                            className="w-full py-2.5 bg-gradient-to-r from-[#0275BC] to-sky-500 hover:from-[#015386] hover:to-sky-600 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/20 transition flex items-center justify-center gap-2"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>Xác nhận & Giữ kho trực tiếp</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center space-y-2">
                          <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Đã tạo Booking thành công!</span>
                          </div>
                          <p className="text-xs text-slate-300">
                            Mã xác nhận:{" "}
                            <strong className="text-white font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                              {bookingRef}
                            </strong>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Nhân viên MyStorage tại chi nhánh 375 Võ Nguyên Giáp sẽ liên hệ theo SĐT 0936203020 trước ngày dọn vào.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/60 overflow-x-auto scrollbar-none flex items-center gap-2">
            <span className="text-[11px] text-slate-500 whitespace-nowrap">Gợi ý nhanh:</span>
            {[
              "Báo giá lưu trữ giúp em",
              "Giới thiệu về MyStorage",
              "Tell me about your services",
              "Tôi muốn đặt luôn",
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => sendQuery(chip)}
                disabled={isStreaming}
                className="text-[11px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-full border border-slate-700 transition disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-950 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendQuery(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Nhắn tin với STOW về giá kho, kích thước hoặc đặt lịch..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isStreaming}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="h-10 w-10 rounded-xl bg-[#0275BC] hover:bg-[#015386] text-white flex items-center justify-center disabled:opacity-30 transition shadow-lg shadow-[#0275BC]/20 shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
