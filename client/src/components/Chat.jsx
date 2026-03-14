import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";
import Button from "./Button";
import { useGameStore } from "../store/gameStore";

const Chat = ({ messages, onSendMessage }) => {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);
  const unreadMessages = useGameStore((state) => state.unreadMessages);
  const chatOpen = useGameStore((state) => state.chatOpen);
  const setChatOpen = useGameStore((state) => state.setChatOpen);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const toggleChat = () => {
    setChatOpen(!chatOpen);
  };

  return (
    <>
      {/* Chat toggle button */}
      <div className="fixed bottom-4 right-4 z-40">
        <motion.button
          className="w-14 h-14 bg-emerald-600 rounded-full shadow-lg flex items-center justify-center text-white"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleChat}
        >
          <MessageCircle size={28} />
        </motion.button>
        {/* Unread notification dot */}
        {unreadMessages > 0 && !chatOpen && (
          <motion.span
            key={unreadMessages}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.3 }}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white"
          >
            {unreadMessages > 9 ? "9+" : unreadMessages}
          </motion.span>
        )}
      </div>

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed bottom-20 right-4 w-80 h-96 bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-gray-700 flex flex-col z-40"
          >
            <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
              <h3 className="text-white font-semibold">Chat</h3>
              <button
                onClick={() => setChatOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {messages.map((msg, index) => (
                <div key={index} className="bg-gray-800/50 rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{msg.avatar}</span>
                    <span className="text-gray-300 text-sm font-semibold">
                      {msg.username}
                    </span>
                  </div>
                  <p className="text-white text-sm">{msg.message}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                maxLength={200}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Chat;
