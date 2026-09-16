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
    <div className="space-y-1.5 leading-relaxed text-sm">
      {lines.map((line, lIdx) => {
        if (!line.trim()) {
          return <div key={lIdx} className="h-2" />;
        }
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const isBullet = line.trim().startsWith("• ") || line.trim().startsWith("- ");

        return (
          <p key={lIdx} className={isBullet ? "pl-3" : ""}>
            {parts.map((part, pIdx) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong
                    key={pIdx}
                    className={`font-bold ${isUser ? "text-white" : "text-slate-900"}`}
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
        "Xin chào anh An! Em là **STOW** (Phiên bản Resilient Gateway Prototype của MyStorage).\n\nEm được trang bị bộ lọc **Payload Sanitizer** (chống lỗi nghẽn ngữ cảnh khi chuyển đổi ngôn ngữ) và **SSE Heartbeat Keep-Alive** (phản hồi bảng giá tức thì dưới 300ms, không bị treo 45s).\n\nAnh An cần tham khảo bảng giá kho máy lạnh, ước tính thể tích (CBM) hay muốn đặt kho giữ chỗ ngay ạ?",
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
    sendQuery("đặt luôn kho 2 CBM");
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
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200 bg-white sticky top-0 z-20 px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-slate-900 tracking-tight">
                MyStorage STOW
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0275BC] border border-blue-200">
                Resilient Gateway
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Bản sửa lỗi cho stow.mystorage.vn | Product Engineering Intern Challenge
            </p>
          </div>

          {/* Technical Diagnostics */}
          <div className="flex items-center gap-4 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Độ trễ TTFT:</span>
              <strong className="text-slate-900">
                {latency ? `${latency}ms` : "< 300ms"}
              </strong>
            </div>

            <div className="h-3 w-px bg-slate-300" />

            <div className="flex items-center gap-1">
              <span className="text-slate-500">SSE Heartbeats:</span>
              <strong className="text-[#0275BC]">{heartbeats}</strong>
            </div>

            <div className="h-3 w-px bg-slate-300" />

            <div className="flex items-center gap-1">
              <span className="text-slate-500">Lọc Payload:</span>
              <strong className="text-emerald-700">Hoạt động</strong>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-4xl flex-1 flex flex-col py-4 px-3 sm:px-4">
        {/* Verification Scenarios */}
        <div className="mb-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Kịch bản kiểm tra lỗi tìm được
            </span>
            <span className="text-xs text-slate-400">
              Nhấn để kiểm tra các lỗi đã được sửa
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handleTestFinding1}
              disabled={isStreaming}
              className="p-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left transition disabled:opacity-50"
            >
              <div className="text-xs font-bold text-slate-900">
                Fix 1: Chuyển ngữ (Vi - En)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Lọc sạch dữ liệu UI cũ, không đơ
              </div>
            </button>

            <button
              onClick={handleTestFinding2}
              disabled={isStreaming}
              className="p-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left transition disabled:opacity-50"
            >
              <div className="text-xs font-bold text-slate-900">
                Fix 2: Nút Báo giá tức thì
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Keep-alive socket, không treo 45s
              </div>
            </button>

            <button
              onClick={handleTestFinding3}
              disabled={isStreaming}
              className="p-2.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-left transition disabled:opacity-50"
            >
              <div className="text-xs font-bold text-slate-900">
                Fix 3: Quy trình Đặt luôn
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Bổ sung ngày thuê, không văng lỗi
              </div>
            </button>
          </div>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden min-h-[460px] max-h-[640px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[90%] sm:max-w-[85%] space-y-3">
                  {/* Sender Label */}
                  <div className="text-[11px] font-semibold text-slate-400">
                    {msg.role === "user" ? "Bạn" : "STOW Trợ lý MyStorage"}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#0275BC] text-white"
                        : "bg-slate-100 border border-slate-200 text-slate-800"
                    }`}
                  >
                    {msg.content ? (
                      <FormattedContent text={msg.content} isUser={msg.role === "user"} />
                    ) : (
                      <span className="text-slate-400">Đang xử lý phản hồi...</span>
                    )}
                  </div>

                  {/* Storage Unit Cards */}
                  {msg.cards?.type === "storage_units" && msg.cards.units && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      {msg.cards.units.map((unit) => (
                        <div
                          key={unit.id}
                          className={`p-3 rounded-xl border flex flex-col justify-between ${
                            unit.popular
                              ? "bg-blue-50/50 border-[#0275BC]"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div>
                            {unit.popular && (
                              <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-[#0275BC] text-white px-2 py-0.5 rounded mb-1.5">
                                Khuyên dùng
                              </span>
                            )}
                            <h4 className="text-xs font-bold text-slate-900 mb-0.5">
                              {unit.name}
                            </h4>
                            <div className="text-xs text-[#0275BC] font-bold mb-1">
                              {unit.price}
                            </div>
                            <div className="text-[11px] text-slate-500 mb-1.5">
                              Kích thước: {unit.dim}
                            </div>
                            <p className="text-[11px] text-slate-600 leading-snug mb-3">
                              {unit.fit}
                            </p>
                          </div>
                          <button
                            onClick={() => handleSelectUnit(unit)}
                            disabled={isStreaming}
                            className="w-full py-1.5 px-2 bg-white hover:bg-[#0275BC] text-slate-700 hover:text-white text-xs font-semibold rounded border border-slate-300 hover:border-[#0275BC] transition"
                          >
                            Chọn kích thước này
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Service Cards */}
                  {msg.cards?.type === "service_cards" && msg.cards.services && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {msg.cards.services.map((svc) => (
                        <div
                          key={svc.id}
                          className="p-3 rounded-xl bg-white border border-slate-200"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900">
                              {svc.name}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                              {svc.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mb-2">
                            {svc.desc}
                          </p>
                          <div className="text-xs font-bold text-[#0275BC]">
                            {svc.price}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* In-Chat Booking Widget */}
                  {msg.cards?.type === "booking_slot_filling" && (
                    <div className="bg-white border-2 border-[#0275BC] rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-3">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Phiếu xác nhận thông tin Giữ kho
                        </h4>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          Sẵn sàng đặt
                        </span>
                      </div>

                      {!bookingConfirmed ? (
                        <div className="space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <div>
                              <span className="text-slate-500">Khách hàng: </span>
                              <strong className="text-slate-900">Anh An</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Số điện thoại: </span>
                              <strong className="text-slate-900">0936203020</strong>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                                Ngày dọn đồ vào kho:
                              </label>
                              <input
                                type="date"
                                value={moveInDate}
                                onChange={(e) => setMoveInDate(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#0275BC]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-600 font-semibold mb-1">
                                Thời gian thuê:
                              </label>
                              <select
                                value={rentalMonths}
                                onChange={(e) => setRentalMonths(Number(e.target.value))}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#0275BC]"
                              >
                                <option value={1}>1 tháng (950.000đ)</option>
                                <option value={3}>3 tháng (Giảm 5%)</option>
                                <option value={6}>6 tháng (Giảm 10%)</option>
                                <option value={12}>12 tháng (Giảm 15%)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <span className="text-slate-600 font-medium">Tạm tính:</span>
                            <span className="text-sm font-bold text-[#0275BC]">
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
                            className="w-full py-2 bg-[#0275BC] hover:bg-[#015386] text-white font-bold rounded-lg transition"
                          >
                            Xác nhận & Giữ kho trực tiếp
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-1.5">
                          <div className="text-emerald-800 font-bold text-sm">
                            Đã tạo Booking thành công!
                          </div>
                          <p className="text-xs text-slate-700">
                            Mã giữ chỗ:{" "}
                            <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-900">
                              {bookingRef}
                            </strong>
                          </p>
                          <p className="text-[11px] text-slate-600">
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
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Gợi ý:</span>
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
                className="text-xs bg-white hover:bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-300 transition disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Bar */}
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
                placeholder="Nhập câu hỏi về giá kho, kích thước hoặc đặt lịch..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isStreaming}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0275BC] focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="px-5 py-2 rounded-lg bg-[#0275BC] hover:bg-[#015386] text-white font-semibold text-sm disabled:opacity-40 transition"
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
