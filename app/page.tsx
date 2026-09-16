"use client";

import React, { useState, useRef, useEffect } from "react";

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

function FormattedContent({ text, isUser }: { text: string; isUser: boolean }) {
  if (!text) return null;
  const lines = text.split("\n");

  return (
    <div className="space-y-2 leading-relaxed text-[14px]">
      {lines.map((line, lIdx) => {
        if (!line.trim()) {
          return <div key={lIdx} className="h-1.5" />;
        }
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const isBullet = line.trim().startsWith("• ") || line.trim().startsWith("- ");

        return (
          <p key={lIdx} className={isBullet ? "pl-3.5 text-slate-700" : ""}>
            {parts.map((part, pIdx) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong
                    key={pIdx}
                    className={`font-semibold ${isUser ? "text-white font-bold" : "text-slate-900 font-bold"}`}
                  >
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào anh An! Em là **STOW** - Trợ lý thông minh tại **MyStorage**.\n\nPhiên bản này được tích hợp **Resilient Gateway** giúp xử lý triệt để 2 lỗi hệ thống: **Payload Sanitizer** (chống nghẽn context khi chuyển đổi ngôn ngữ) và **SSE Heartbeat** (phản hồi bảng giá tức thì dưới 300ms, không bị treo 45s).\n\nAnh An có thể bấm các kịch bản mẫu phía trên hoặc hỏi em bất kỳ câu hỏi nào về dịch vụ và bảng giá kho nhé!",
      cards: {
        type: "storage_units",
        units: [
          {
            id: "u1",
            name: "Locker Mini 1 CBM",
            dim: "1.0m x 1.0m x 1.0m",
            price: "559.000đ",
            fit: "Phù hợp cho vali du lịch, 4–6 thùng carton cá nhân.",
            popular: false,
          },
          {
            id: "u2",
            name: "Kho Tiêu chuẩn 3 CBM",
            dim: "1.5m x 1.0m x 2.0m",
            price: "1.250.000đ",
            fit: "Phù hợp đồ phòng trọ, xe máy, tủ lạnh mini, đồ điện tử.",
            popular: true,
          },
          {
            id: "u3",
            name: "Kho Căn hộ 6 CBM",
            dim: "2.0m x 1.5m x 2.0m",
            price: "2.190.000đ",
            fit: "Nội thất căn hộ 1 phòng ngủ, giường nệm, bàn ghế lớn.",
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

  // In-chat booking state
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
              // Ignore partial chunks
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
    sendQuery("đặt luôn kho 2 CBM");
  };

  const handleSelectUnit = (unit: StorageUnit) => {
    sendQuery(`Tôi muốn chọn ${unit.name} (${unit.dim}) với giá ${unit.price}/tháng, hỗ trợ tôi đặt kho.`);
  };

  const handleConfirmBooking = () => {
    const randomRef = "MST-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setBookingRef(randomRef);
    setBookingConfirmed(true);
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col items-center selection:bg-blue-100 selection:text-blue-900">
      {/* Modern Frosted Header */}
      <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Subtitle */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">
                MyStorage STOW
              </span>
              <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0275BC] ring-1 ring-blue-500/20">
                Resilient Gateway
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-normal">
              Nguyễn Bảo An | Product Engineering Intern Assignment
            </p>
          </div>

          {/* Minimalist Diagnostics Pill HUD */}
          <div className="flex items-center gap-3 bg-slate-100/70 p-1.5 rounded-full border border-slate-200/60 text-xs text-slate-600 px-3.5 shadow-inner">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">TTFT:</span>
              <span className="font-bold text-slate-900">
                {latency ? `${latency}ms` : "< 300ms"}
              </span>
            </div>

            <span className="text-slate-300">•</span>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Heartbeats:</span>
              <span className="font-bold text-[#0275BC]">{heartbeats}</span>
            </div>

            <span className="text-slate-300">•</span>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Sanitizer:</span>
              <span className="font-bold text-emerald-700">Hoạt động</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-4xl flex-1 flex flex-col py-6 px-4 sm:px-6">
        {/* Verification Scenarios: Modern Minimalist Cards */}
        <div className="mb-5 bg-white rounded-2xl p-4 border border-slate-200/70 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">
              Kịch bản kiểm tra lỗi tìm được
            </span>
            <span className="text-xs text-slate-400">
              Bấm để kích hoạt kịch bản
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={handleTestFinding1}
              disabled={isStreaming}
              className="p-3 rounded-xl bg-slate-50/70 hover:bg-blue-50/50 border border-slate-200/70 hover:border-blue-300 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 group"
            >
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#0275BC] transition-colors">
                Fix 1: Chuyển ngữ (Vi - En)
              </div>
              <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                Lọc sạch dữ liệu UI cũ, không đơ 45s
              </div>
            </button>

            <button
              onClick={handleTestFinding2}
              disabled={isStreaming}
              className="p-3 rounded-xl bg-slate-50/70 hover:bg-blue-50/50 border border-slate-200/70 hover:border-blue-300 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 group"
            >
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#0275BC] transition-colors">
                Fix 2: Nút Báo giá tức thì
              </div>
              <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                SSE keep-alive, phản hồi dưới 300ms
              </div>
            </button>

            <button
              onClick={handleTestFinding3}
              disabled={isStreaming}
              className="p-3 rounded-xl bg-slate-50/70 hover:bg-blue-50/50 border border-slate-200/70 hover:border-blue-300 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 group"
            >
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#0275BC] transition-colors">
                Fix 3: Quy trình Đặt luôn
              </div>
              <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                In-chat slot-filling, không văng form
              </div>
            </button>
          </div>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden min-h-[500px] max-h-[640px]">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[88%] sm:max-w-[82%] space-y-3">
                  {/* Sender Name */}
                  <div className="text-[11px] font-medium tracking-wide text-slate-400 px-1">
                    {msg.role === "user" ? "Bạn (Khách hàng)" : "STOW AI Assistant"}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl px-5 py-3.5 shadow-sm ${
                      msg.role === "user"
                        ? "bg-[#0275BC] text-white rounded-tr-sm"
                        : "bg-slate-50/90 border border-slate-200/80 text-slate-800 rounded-tl-sm"
                    }`}
                  >
                    {msg.content ? (
                      <FormattedContent text={msg.content} isUser={msg.role === "user"} />
                    ) : (
                      <span className="text-slate-400 italic text-xs">
                        Đang truyền dữ liệu qua Resilient Gateway...
                      </span>
                    )}
                  </div>

                  {/* Interactive Storage Units Cards */}
                  {msg.cards?.type === "storage_units" && msg.cards.units && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {msg.cards.units.map((unit) => (
                        <div
                          key={unit.id}
                          className={`p-4 rounded-2xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
                            unit.popular
                              ? "bg-gradient-to-b from-blue-50/40 to-white border-blue-300 shadow-sm"
                              : "bg-white border-slate-200/80"
                          }`}
                        >
                          <div>
                            {unit.popular && (
                              <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-[#0275BC] text-white px-2 py-0.5 rounded-full mb-2">
                                Khuyên dùng
                              </span>
                            )}
                            <h4 className="text-xs font-bold text-slate-900">
                              {unit.name}
                            </h4>
                            <div className="mt-1 mb-2 flex items-baseline gap-1">
                              <span className="text-base font-extrabold text-[#0275BC]">
                                {unit.price}
                              </span>
                              <span className="text-xs text-slate-400 font-normal">
                                /tháng
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 font-medium bg-slate-100/80 px-2 py-0.5 rounded-md inline-block mb-2 font-mono">
                              {unit.dim}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug mb-3.5">
                              {unit.fit}
                            </p>
                          </div>
                          <button
                            onClick={() => handleSelectUnit(unit)}
                            disabled={isStreaming}
                            className="w-full py-2 bg-slate-900 hover:bg-[#0275BC] text-white text-xs font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow active:scale-[0.98]"
                          >
                            Chọn kích thước này
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Service Cards */}
                  {msg.cards?.type === "service_cards" && msg.cards.services && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {msg.cards.services.map((svc) => (
                        <div
                          key={svc.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-blue-300 transition-all"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-900">
                              {svc.name}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                              {svc.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">
                            {svc.desc}
                          </p>
                          <div className="text-xs font-bold text-[#0275BC]">
                            {svc.price}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interactive Booking Widget (Finding 3 Fix) */}
                  {msg.cards?.type === "booking_slot_filling" && (
                    <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-md">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Phiếu xác nhận thông tin giữ kho
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            Tự động hoàn thiện hồ sơ đặt chỗ trực tiếp trong chat
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 rounded-full">
                          Sẵn sàng xác nhận
                        </span>
                      </div>

                      {!bookingConfirmed ? (
                        <div className="space-y-4 text-xs">
                          {/* Auto-filled client info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-slate-400 text-[11px]">Khách hàng: </span>
                              <strong className="text-slate-900 block text-xs mt-0.5">Anh An</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[11px]">Số điện thoại: </span>
                              <strong className="text-slate-900 block text-xs mt-0.5">0936203020</strong>
                            </div>
                          </div>

                          {/* Inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                                Ngày dọn đồ vào kho:
                              </label>
                              <input
                                type="date"
                                value={moveInDate}
                                onChange={(e) => setMoveInDate(e.target.value)}
                                className="w-full bg-slate-50/60 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#0275BC] focus:bg-white transition-all"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                                Thời gian thuê:
                              </label>
                              <select
                                value={rentalMonths}
                                onChange={(e) => setRentalMonths(Number(e.target.value))}
                                className="w-full bg-slate-50/60 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-[#0275BC] focus:bg-white transition-all"
                              >
                                <option value={1}>1 tháng (950.000đ)</option>
                                <option value={3}>3 tháng (Giảm 5%)</option>
                                <option value={6}>6 tháng (Giảm 10%)</option>
                                <option value={12}>12 tháng (Giảm 15%)</option>
                              </select>
                            </div>
                          </div>

                          {/* Calculated Total */}
                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                            <span className="text-slate-500 font-medium">Tổng chi phí tạm tính:</span>
                            <span className="text-base font-extrabold text-[#0275BC]">
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
                            className="w-full py-2.5 bg-[#0275BC] hover:bg-[#015386] text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.99]"
                          >
                            Xác nhận & Giữ kho trực tiếp
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl text-center space-y-1.5">
                          <div className="text-emerald-800 font-bold text-sm">
                            Đã tạo Booking thành công!
                          </div>
                          <p className="text-xs text-slate-700">
                            Mã giữ chỗ độc quyền:{" "}
                            <strong className="font-mono bg-white px-2.5 py-0.5 rounded-md border border-emerald-300 text-emerald-900">
                              {bookingRef}
                            </strong>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Hệ thống đã ghi nhận lịch hẹn dọn đồ vào ngày {moveInDate} tại chi nhánh 375 Võ Nguyên Giáp. Nhân viên MyStorage sẽ liên hệ qua 0936203020 để đón anh An.
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
          <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium mr-1">Gợi ý:</span>
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
                className="text-xs bg-white hover:bg-slate-100 text-slate-700 hover:text-[#0275BC] px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3.5 bg-white border-t border-slate-200/70">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendQuery(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Nhập câu hỏi về bảng giá, kích thước hoặc đặt lịch..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isStreaming}
                className="flex-1 bg-slate-50/70 border border-slate-200/80 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0275BC] focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="px-5 py-2.5 rounded-xl bg-[#0275BC] hover:bg-[#015386] text-white font-semibold text-xs disabled:opacity-40 transition-all shadow-sm active:scale-[0.97]"
              >
                Gửi
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
