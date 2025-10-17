import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { getSuggestedReply, searchEmails, setCategory } from './api';
import './App.css';

type Email = {
  id: string;
  accountId: string;
  folder: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  text?: string;
  category?: string;
}

const socket = io((import.meta as any).env.VITE_SOCKET_ORIGIN || 'http://localhost:4000');

export default function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [q, setQ] = useState('');
  const [accountId, setAccountId] = useState('');
  const [folder, setFolder] = useState('');
  const [category, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Email | null>(null);
  const [suggestion, setSuggestion] = useState('');

  const categories = ['Interested','Meeting Booked','Not Interested','Spam','Out of Office','Uncategorized'];

  const accounts = useMemo(() => Array.from(new Set(emails.map(e => e.accountId))), [emails]);
  const folders = useMemo(() => Array.from(new Set(emails.map(e => e.folder))), [emails]);

  async function load() {
    setLoading(true);
    const results = await searchEmails({ q, accountId: accountId || undefined, folder: folder || undefined, category: category || undefined });
    setEmails(results);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // realtime refresh on new email
    socket.on('email:new', load);
    return () => { socket.off('email:new', load); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markCategory(e: Email, category: string) {
    await setCategory(e.id, category, e.subject, e.from);
    await load();
  }

  async function suggest(e: Email, responseType: string = 'professional') {
    setSelected(e);
    setSuggestion('Generating...');
    const reply = await getSuggestedReply(`${e.subject}\n${e.text || ''}`, responseType);
    setSuggestion(reply);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <h1>📧 ReachInbox Onebox</h1>
            <p>Professional Email Management & AI-Powered Responses</p>
          </div>
          <div className="header-stats">
            <div className="stat">
              <span className="stat-number">{emails.length}</span>
              <span className="stat-label">Emails</span>
            </div>
            <div className="stat">
              <span className="stat-number">{accounts.length}</span>
              <span className="stat-label">Accounts</span>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="filters-section">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Search</label>
              <input 
                type="text" 
                placeholder="Search emails..." 
                value={q} 
                onChange={e => setQ(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="filter-group">
              <label>Account</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} className="filter-select">
                <option value="">All Accounts</option>
                {accounts.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Folder</label>
              <select value={folder} onChange={e => setFolder(e.target.value)} className="filter-select">
                <option value="">All Folders</option>
                {folders.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Category</label>
              <select value={category} onChange={e => setCategoryFilter(e.target.value)} className="filter-select">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="filter-group">
              <button 
                onClick={load} 
                disabled={loading} 
                className={`search-btn ${loading ? 'loading' : ''}`}
              >
                {loading ? '⏳ Loading...' : '🔍 Search'}
              </button>
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="emails-section">
            <div className="section-header">
              <h2>📬 Email Inbox</h2>
              <span className="email-count">{emails.length} emails</span>
            </div>
            
            <div className="emails-list">
              {emails.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <h3>No emails found</h3>
                  <p>Try adjusting your search filters or check your connection.</p>
                </div>
              ) : (
                emails.map(e => (
                  <div key={e.id} className="email-card">
                    <div className="email-header">
                      <div className="email-subject">
                        <h3>{e.subject || '(No Subject)'}</h3>
                        <span className="email-time">{new Date(e.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="email-meta">
                      <div className="email-from">
                        <span className="from-label">From:</span>
                        <span className="from-address">{e.from}</span>
                      </div>
                    </div>
                    
                    <div className="email-tags">
                      <span className={`tag tag-account`}>{e.accountId}</span>
                      <span className={`tag tag-folder`}>{e.folder}</span>
                      <span className={`tag tag-category ${(e.category || 'Uncategorized').toLowerCase().replace(/\s+/g, '-')}`}>
                        {e.category || 'Uncategorized'}
                      </span>
                    </div>
                    
                    <div className="email-actions">
                      <div className="category-buttons">
                        <button 
                          onClick={() => markCategory(e, 'Interested')} 
                          className="btn btn-success"
                        >
                          ✅ Interested
                        </button>
                        <button 
                          onClick={() => markCategory(e, 'Meeting Booked')} 
                          className="btn btn-info"
                        >
                          📅 Meeting
                        </button>
                        <button 
                          onClick={() => markCategory(e, 'Not Interested')} 
                          className="btn btn-warning"
                        >
                          ❌ Not Interested
                        </button>
                        <button 
                          onClick={() => markCategory(e, 'Spam')} 
                          className="btn btn-danger"
                        >
                          🚫 Spam
                        </button>
                        <button 
                          onClick={() => markCategory(e, 'Out of Office')} 
                          className="btn btn-secondary"
                        >
                          🏠 Out of Office
                        </button>
                      </div>
                      <div className="ai-actions">
                        <button 
                          onClick={() => suggest(e, 'professional')} 
                          className="btn btn-primary"
                        >
                          🤖 Professional Reply
                        </button>
                        <button 
                          onClick={() => suggest(e, 'casual')} 
                          className="btn btn-outline"
                        >
                          😊 Casual Reply
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="suggestion-section">
            <div className="section-header">
              <h2>🤖 AI Reply Assistant</h2>
            </div>
            
            {selected ? (
              <div className="suggestion-content">
                <div className="selected-email">
                  <h4>Replying to:</h4>
                  <p className="selected-subject">{selected.subject}</p>
                  <p className="selected-from">From: {selected.from}</p>
                </div>
                
                <div className="suggestion-box">
                  <h4>Suggested Reply:</h4>
                  <div className="suggestion-text">
                    {suggestion === 'Generating...' ? (
                      <div className="loading-suggestion">
                        <div className="spinner"></div>
                        <span>Generating AI response...</span>
                      </div>
                    ) : (
                      <div className="suggestion-content-text">{suggestion}</div>
                    )}
                  </div>
                </div>
                
                <div className="suggestion-actions">
                  <div className="response-type-buttons">
                    <button 
                      onClick={() => suggest(selected, 'professional')} 
                      className="btn btn-outline"
                    >
                      💼 Professional
                    </button>
                    <button 
                      onClick={() => suggest(selected, 'casual')} 
                      className="btn btn-outline"
                    >
                      😊 Casual
                    </button>
                    <button 
                      onClick={() => suggest(selected, 'follow-up')} 
                      className="btn btn-outline"
                    >
                      🔄 Follow-up
                    </button>
                    <button 
                      onClick={() => suggest(selected, 'decline')} 
                      className="btn btn-outline"
                    >
                      ❌ Decline
                    </button>
                    <button 
                      onClick={() => suggest(selected, 'auto-reply')} 
                      className="btn btn-outline"
                    >
                      🏠 Auto-reply
                    </button>
                  </div>
                  <div className="action-buttons">
                    <button 
                      onClick={() => navigator.clipboard.writeText(suggestion)}
                      className="btn btn-success"
                    >
                      📋 Copy Reply
                    </button>
                    <button className="btn btn-outline">📧 Send Email</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-suggestion">
                <div className="empty-icon">💡</div>
                <h3>Ready to help!</h3>
                <p>Select an email and click "AI Reply" to get a personalized response suggestion.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


