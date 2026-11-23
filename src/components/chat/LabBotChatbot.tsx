import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Equipment, UserProfile } from '../../types/lablink';
import { api } from '../../lib/api';
import { LabBotMascot } from '../motion/LabBotMascot';
import { SPRING_TACTILE, TactileButton, usePrefersReducedMotion } from '../motion/MotionPrimitives';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  safetyNote?: string;
  suggestedEquipmentIds?: string[];
  suggestedRoute?: string;
  isError?: boolean;
}

interface LabBotChatbotProps {
  equipment: Equipment[];
  user: UserProfile | null;
  inWorkspace: boolean;
  onOpenEquipment: (equipmentId: string) => void;
  onNavigateRoute: (route: string) => void;
}

const ROUTE_LABELS: Record<string, string> = {
  discover: 'Find Equipment',
  'my-reservations': 'Manage Bookings',
  projects: 'Project Access',
  'lab-map': 'Explore Labs',
  'ai-assistant': 'Booking Conflicts',
  approvals: 'Waiting for Approval',
  'admin-console': 'Usage Reports',
};

const QUICK_PROMPTS = [
  'Which 3D printer or laser cutter is free today?',
  'Suggest tools for an Arduino robot project',
  'How do I book equipment or request access?',
];

export const LabBotChatbot: React.FC<LabBotChatbotProps> = ({
  equipment,
  user,
  inWorkspace,
  onOpenEquipment,
  onNavigateRoute,
}) => {
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const welcomeMessage = (): ChatTurn => ({
    id: 'welcome',
    role: 'assistant',
    text: user
      ? `Hi ${user.name.split(' ')[0]}! Ask me about available tools, safety rules, or your ${user.role} bookings.`
      : 'Hi! Ask me what tools are available, what safety training is needed, or how to book equipment.',
  });

  const [messages, setMessages] = useState<ChatTurn[]>([welcomeMessage()]);

  // Update welcome greeting when auth state switches while chat only has welcome message
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === 'welcome' ? [welcomeMessage()] : prev,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (scrollRef.current && open && !minimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking, open, minimized]);

  const sendMessage = async (overrideText?: string) => {
    const query = (overrideText ?? input).trim();
    if (!query || thinking) return;

    const historyForServer = messages
      .filter((m) => m.id !== 'welcome' && !m.isError)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
    };

    if (!overrideText) setInput('');
    setMessages((prev) => [...prev, userTurn]);
    setThinking(true);
    setMinimized(false);

    try {
      const res = await api.aiAssistant(query, historyForServer);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          text: res.answer,
          safetyNote: res.safetyNote,
          suggestedEquipmentIds: res.suggestedEquipmentIds,
          suggestedRoute: res.suggestedRoute,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text:
            err instanceof Error
              ? err.message
              : 'LabBot could not reach the AI assistant right now.',
          isError: true,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleClear = () => {
    setMessages([welcomeMessage()]);
  };

  return (
    <aside
      aria-label="LabBot Assistant"
      className={`fixed right-4 sm:right-5 z-50 flex flex-col items-end ${
        inWorkspace ? 'bottom-20 lg:bottom-5' : 'bottom-5'
      }`}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            transition={SPRING_TACTILE}
            className="mb-3 w-[calc(100vw-2rem)] sm:w-[24rem] bg-[#ffffff]/96 backdrop-blur-md rounded-[2rem] clay-card overflow-hidden flex flex-col"
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#f8f3e8]/80 border-b border-[#e7e2d7]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#a8e8d5] flex items-center justify-center text-[#29695a] shrink-0">
                  <span className="material-symbols-outlined text-[22px]">smart_toy</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#1d1c15]">LabBot</h4>
                    <span className="px-2 py-0.5 rounded-full bg-[#b0e4fd] text-[#32677c] text-[10px] font-semibold capitalize">
                      {user ? user.role : 'Visitor'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#29695a] font-medium truncate">
                    {thinking ? 'LabBot is thinking...' : 'AI Lab Helper'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleClear}
                  title="Clear chat"
                  aria-label="Clear chat"
                  className="w-8 h-8 rounded-full hover:bg-[#ffffff] flex items-center justify-center text-[#3f4945] cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMinimized((m) => !m)}
                  title={minimized ? 'Expand chat' : 'Minimize chat'}
                  aria-label={minimized ? 'Expand chat' : 'Minimize chat'}
                  className="w-8 h-8 rounded-full hover:bg-[#ffffff] flex items-center justify-center text-[#3f4945] cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {minimized ? 'open_in_full' : 'minimize'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title="Close chat"
                  aria-label="Close chat"
                  className="w-8 h-8 rounded-full hover:bg-[#ffffff] flex items-center justify-center text-[#3f4945] cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Scrollable Message List */}
                <div
                  ref={scrollRef}
                  className="px-4 py-3.5 flex flex-col gap-3 max-h-72 overflow-y-auto bg-[#fef9ee]/45"
                >
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1.5 max-w-[88%] ${
                        msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          msg.isError
                            ? 'bg-[#ffdad6] text-[#93000a] rounded-tl-sm'
                            : msg.role === 'user'
                              ? 'bg-[#a8e8d5] text-[#1c4b40] rounded-tr-sm font-medium'
                              : 'bg-[#ffffff] text-[#1d1c15] rounded-tl-sm clay-button-soft'
                        }`}
                      >
                        <p>{msg.text}</p>
                        {msg.safetyNote && !msg.isError && (
                          <p className="mt-1.5 pt-1.5 border-t border-[#e7e2d7] text-[11px] text-[#29695a] font-semibold">
                            Safety tip: {msg.safetyNote}
                          </p>
                        )}
                      </div>

                      {/* Clickable Suggested Equipment Links */}
                      {msg.suggestedEquipmentIds && msg.suggestedEquipmentIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.suggestedEquipmentIds.map((eqId) => {
                            const eq = equipment.find((item) => item.id === eqId);
                            if (!eq) return null;
                            return (
                              <button
                                key={eq.id}
                                type="button"
                                onClick={() => onOpenEquipment(eq.id)}
                                className="px-2.5 py-1 rounded-full bg-[#b0e4fd] hover:brightness-95 text-[#114d61] text-[11px] font-semibold cursor-pointer transition-all"
                              >
                                {eq.name} →
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Clickable Suggested Page Link */}
                      {msg.suggestedRoute && ROUTE_LABELS[msg.suggestedRoute] && (
                        <button
                          type="button"
                          onClick={() => onNavigateRoute(msg.suggestedRoute!)}
                          className="px-2.5 py-1 rounded-full bg-[#f8de91] hover:brightness-95 text-[#4a3800] text-[11px] font-semibold cursor-pointer transition-all"
                        >
                          Open {ROUTE_LABELS[msg.suggestedRoute]} →
                        </button>
                      )}
                    </div>
                  ))}

                  {thinking && (
                    <div className="self-start bg-[#ffffff] rounded-2xl rounded-tl-sm px-3.5 py-2.5 clay-button-soft flex items-center gap-2 text-xs text-[#3f4945]">
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#29695a] animate-bounce" />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#29695a] animate-bounce"
                          style={{ animationDelay: '120ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#29695a] animate-bounce"
                          style={{ animationDelay: '240ms' }}
                        />
                      </span>
                      <span>Checking campus labs...</span>
                    </div>
                  )}
                </div>

                {/* Quick Sample Prompt Chips */}
                <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-[#e7e2d7]/70 bg-[#ffffff]">
                  {QUICK_PROMPTS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => sendMessage(chip)}
                      disabled={thinking}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-[#f8f3e8] hover:bg-[#b0e4fd] text-[#1d1c15] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Input Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="px-4 py-3 bg-[#f8f3e8]/65 border-t border-[#e7e2d7] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask LabBot about tools or bookings..."
                    className="flex-1 bg-[#ffffff] rounded-full px-3.5 py-2 text-xs text-[#1d1c15] placeholder:text-[#707975] clay-well focus:outline-none min-w-0"
                  />
                  <TactileButton
                    type="submit"
                    variant="primary"
                    loading={thinking}
                    disabled={!input.trim()}
                    aria-label="Send message"
                    className="px-3.5 py-2 text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                  </TactileButton>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bottom-Right Launcher */}
      <div className="flex items-center gap-2">
        <LabBotMascot
          size="sm"
          thinking={thinking}
          showSpeechBubble={false}
          onMascotClick={() => {
            setOpen((prev) => !prev);
            setMinimized(false);
          }}
        />
        <TactileButton
          variant="soft"
          onClick={() => {
            setOpen((prev) => !prev);
            setMinimized(false);
          }}
          className="px-4 py-2.5 text-xs"
        >
          <span className="material-symbols-outlined text-[16px] text-[#29695a]">chat</span>
          <span>{open ? 'Hide LabBot' : 'Ask LabBot'}</span>
        </TactileButton>
      </div>
    </aside>
  );
};
