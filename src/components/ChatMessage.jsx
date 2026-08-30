import React from 'react';
import MetricCards from './MetricCards';
import CaveatsBox from './CaveatsBox';
import { User, Bot, HelpCircle } from 'lucide-react';

export default function ChatMessage({ message, onOptionSelect }) {
  const isUser = message.sender === 'user';

  // Format simple markdown bold and bullet points
  const formatMarkdown = (text) => {
    if (!text) return '';
    let html = text
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>');
    return html;
  };

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div className="message-content">
        {message.isClarification ? (
          <div className="clarification-box">
            <div className="caveats-title" style={{ color: '#c084fc' }}>
              <HelpCircle size={18} />
              <span>Query Clarification Needed</span>
            </div>
            <p>{message.clarificationQuestion}</p>
            <div className="clarification-options">
              {message.options?.map((opt, idx) => (
                <button
                  key={idx}
                  className="btn-option"
                  onClick={() => onOptionSelect(opt)}
                >
                  👉 {opt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(message.text) }}
            />

            {!isUser && message.metricCards && (
              <MetricCards cards={message.metricCards} />
            )}

            {!isUser && message.caveats && message.caveats.length > 0 && (
              <CaveatsBox caveats={message.caveats} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
