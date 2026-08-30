import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ChatMessage from './components/ChatMessage';
import { Send, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';

const STARTER_PROMPTS = [
  { text: "How is our pipeline looking this quarter?", icon: "📊" },
  { text: "Which sector has the highest pipeline value?", icon: "⚡" },
  { text: "What is our current receivables position?", icon: "💰" },
  { text: "Which projects are delayed?", icon: "⚠️" },
  { text: "Compare sales pipeline and execution by sector.", icon: "🌐" },
  { text: "Show top performance", icon: "❓" } // Tests ambiguity clarification!
];

export default function App() {
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: '### 👋 Welcome to Skylark BI Agent\nI am connected to your live **Deals** and **Work Orders** boards. Ask me any founder-level question about revenue, pipeline health, sector bottlenecks, or delayed operations.'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState(true);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    // Check API health status on mount
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setApiConnected(data.mondayApiConnected);
        }
      })
      .catch(() => setApiConnected(false));
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputText;
    if (!textToSend || textToSend.trim() === '' || loading) return;

    // Append user message
    const userMsg = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.isClarification) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            isClarification: true,
            clarificationQuestion: data.clarificationQuestion,
            options: data.options
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: data.response,
            metricCards: data.metricCards,
            caveats: data.caveats
          }
        ]);
      }
    } catch (err) {
      console.error('Chat request error:', err);
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: `⚠️ **Connection Error**: Unable to reach the BI backend service (${err.message}). Please check if the server is running on port 3001.`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLeadershipUpdate = async () => {
    if (loading) return;
    setMessages(prev => [...prev, { sender: 'user', text: 'Generate Leadership Briefing' }]);
    setLoading(true);

    try {
      const response = await fetch('/api/leadership-update');
      if (!response.ok) throw new Error('Leadership update API error');
      const data = await response.json();

      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: data.summaryMarkdown,
          metricCards: [
            { title: 'Active Pipeline', value: data.leadershipData.executiveSummary.activePipelineValue },
            { title: 'Weighted Pipeline', value: data.leadershipData.executiveSummary.weightedPipelineValue },
            { title: 'Billed Revenue', value: data.leadershipData.executiveSummary.billedValue },
            { title: 'Collected Amount', value: data.leadershipData.executiveSummary.collectedAmount },
            { title: 'Outstanding Receivables', value: data.leadershipData.executiveSummary.amountReceivable }
          ],
          caveats: data.leadershipData.dataQualityAudit.caveats
        }
      ]);
    } catch (err) {
      handleSend('Prepare a leadership update');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Header onLeadershipUpdate={handleLeadershipUpdate} apiConnected={apiConnected} />

      <main className="chat-main">
        <div className="chat-history">
          {/* Quick Starter Prompts */}
          {messages.length <= 2 && (
            <div className="quick-prompts-container">
              <div className="quick-prompts-title">Suggested Founder Queries</div>
              <div className="quick-prompts-grid">
                {STARTER_PROMPTS.map((prompt, index) => (
                  <button
                    key={index}
                    className="prompt-card"
                    onClick={() => handleSend(prompt.text)}
                  >
                    <span>{prompt.icon} {prompt.text}</span>
                    <ArrowRight size={14} className="prompt-card-icon" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.map((msg, index) => (
            <ChatMessage
              key={index}
              message={msg}
              onOptionSelect={(opt) => handleSend(opt)}
            />
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="message-row assistant">
              <div className="message-avatar">
                <Sparkles size={18} />
              </div>
              <div className="message-content">
                <div className="typing-loader">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <span style={{ fontSize: '0.85rem', color: '#9ca3af', marginLeft: '0.5rem' }}>
                    Analyzing Monday.com boards & calculating metrics...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask a question about deals, pipeline, revenue, receivables or operations..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <button
            className="btn-send"
            onClick={() => handleSend()}
            disabled={loading || !inputText.trim()}
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </div>
      </main>
    </div>
  );
}
