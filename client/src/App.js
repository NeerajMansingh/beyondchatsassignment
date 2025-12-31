import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Loader2, RefreshCw, Wand2, BookOpen } from 'lucide-react'; 
import './App.css';

// API Endpoints
const API_URL = 'http://localhost:3000'; // Connects to index.js
const AI_URL = 'http://localhost:4000';  // Connects to improve_article.js

function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);

  // 1. Fetch Articles (Calls Phase 1 API)
  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/articles`);
      // Sort by ID to keep the list stable
      const sorted = data.sort((a, b) => a.id - b.id);
      setArticles(sorted);
    } catch (err) {
      console.error(err);
      alert("Error connecting to Backend (Port 3000). Is index.js running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  // 2. Trigger AI Worker (Calls Phase 2 Script)
  const runAIWorker = async () => {
    setProcessing(true);
    try {
      // This endpoint triggers the Google Search + Scrape + Groq LLM flow
      await axios.get(`${AI_URL}/improve`);
      alert("Success! All articles have been researched and updated.");
      fetchArticles(); // Refresh UI to show new data
    } catch (err) {
      console.error(err);
      alert("Error connecting to AI Worker (Port 4000). Is improve_article.js running?");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div>
          <h1>BeyondChats Content Studio</h1>
          <p>AI-Powered Improvisor</p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={fetchArticles} disabled={loading}>
            <RefreshCw size={18} className={loading ? "spin" : ""} />
            {loading ? 'Syncing...' : 'Refresh DB'}
          </button>
          <button className="btn btn-primary" onClick={runAIWorker} disabled={processing}>
            {processing ? <Loader2 size={18} className="spin" /> : <Wand2 size={18} />}
            {processing ? 'AI Researching...' : 'Improve Content with AI'}
          </button>
        </div>
      </header>

      {/* Article Grid */}
      <main className="grid">
        {articles.length === 0 && !loading && (
          <p style={{gridColumn: '1/-1', textAlign: 'center', color: '#666', marginTop: '2rem'}}>
            No articles found. Check if your database has data or run "Refresh DB".
          </p>
        )}

        {articles.map((article) => (
          <div key={article.id} className="card">
            <div className="card-content">
              <span className={article.ai_body ? "badge badge-new" : "badge badge-old"}>
                {article.ai_body ? "✨ Enhanced" : "Original"}
              </span>
              <h2>{article.title}</h2>
              <p className="author">By {article.author}</p>
              <p className="excerpt">
                {article.body ? article.body.substring(0, 100) + "..." : "No content preview."}
              </p>
            </div>
            <div className="card-footer">
              <button className="btn btn-secondary btn-full" onClick={() => setSelectedArticle(article)}>
                <BookOpen size={16} />
                {article.ai_body ? "Compare Versions" : "Read Original"}
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* Comparison Modal */}
      {selectedArticle && (
        <div className="modal-overlay" onClick={() => setSelectedArticle(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{fontSize: '1.2rem', margin:0}}>Reviewing: {selectedArticle.title}</h2>
              <button className="modal-close" onClick={() => setSelectedArticle(null)}>&times;</button>
            </div>
            
            <div className="split-view">
              {/* Left Pane: Original */}
              <div className="pane">
                <h3>Original Scrape</h3>
                <div style={{whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#374151'}}>
                  {selectedArticle.body}
                </div>
              </div>

              {/* Right Pane: AI Version */}
              <div className="pane">
                <h3>AI Enhanced Version</h3>
                {selectedArticle.ai_body ? (
                  <div className="markdown">
                    <ReactMarkdown>{selectedArticle.ai_body}</ReactMarkdown>
                  </div>
                ) : (
                  <div style={{textAlign: 'center', marginTop: '3rem', color: '#9ca3af'}}>
                    <Wand2 size={48} style={{marginBottom: '1rem', opacity: 0.2}} />
                    <p>No AI version generated yet.</p>
                    <p>Click "Improve Content with AI" on the dashboard.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;