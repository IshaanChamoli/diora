'use client';

import { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import axios from 'axios';

export default function Home() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAIMessage, setCurrentAIMessage] = useState<string>('');
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [expertInfoText, setExpertInfoText] = useState<string>('');
  const [expertCards, setExpertCards] = useState<Array<{
    name: string;
    title: string;
    linkedin: string;
    x?: number;
    y?: number;
    floatId?: string;
  }>>([]);
  const vapiRef = useRef<Vapi | null>(null);
  const lastQueryRef = useRef<string>('');
  // Store persistent positions for each card
  const positionsRef = useRef(new Map());
  const [positions, setPositions] = useState<Array<{x: number, y: number, floatId: string, phase: number, isNew: boolean, newBatchIndex?: number}>>([]);
  const [lastBatchIds, setLastBatchIds] = useState<string[]>([]);

  const displayUiTesterButton =
    typeof process !== 'undefined' &&
    typeof process.env !== 'undefined' &&
    process.env.NEXT_PUBLIC_DISPLAY_UI_TESTER_BUTTON === 'true';

  useEffect(() => {
    // Initialize Vapi
    const apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    
    if (!apiKey) {
      setError('VAPI_API_KEY is not set. Please add it to your .env.local file.');
      return;
    }

    if (apiKey === 'sk-your-public-key-here') {
      setError('Please replace "sk-your-public-key-here" with your actual Vapi Public API key in .env.local');
      return;
    }

    if (!assistantId) {
      setError('VAPI_ASSISTANT_ID is not set. Please add it to your .env.local file.');
      return;
    }

    if (assistantId === 'your-assistant-id') {
      setError('Please replace "your-assistant-id" with your actual assistant ID in .env.local');
      return;
    }

    try {
      vapiRef.current = new Vapi(apiKey);

      // Set up event listeners
      vapiRef.current.on('call-start', () => {
        setIsCallActive(true);
        setIsLoading(false);
        setError(null);
        setCurrentAIMessage(''); // Clear current AI message
      });

      vapiRef.current.on('call-end', () => {
        setIsCallActive(false);
        setIsLoading(false);
        setError(null);
        setCurrentAIMessage(''); // Clear subtitle when call ends
        setIsAISpeaking(false);
        setExpertInfoText(''); // Clear expert info when call ends
        setExpertCards([]); // Clear expert cards when call ends
        setPositions([]); // Clear positions
        positionsRef.current = new Map(); // Clear persistent positions
      });

      vapiRef.current.on('error', (error) => {
        console.error('Vapi error:', error);
        setError(`Vapi error: ${JSON.stringify(error)}`);
        setIsLoading(false);
      });

      // Handle transcript messages - only for AI assistant
      vapiRef.current.on('message', (message) => {
        if (message.type === 'transcript' && message.role === 'assistant') {
          // Update current AI message with the latest transcript
          setCurrentAIMessage(message.transcript);
        }
        // Handle tool call start messages - when AI starts making a tool call
        if (message.type === 'tool-calls' || message.type === 'function-calls') {
          console.log('Tool call detected:', message);
          // Try to extract query from the tool call
          if (message.toolCallList && message.toolCallList.length > 0) {
            const toolCall = message.toolCallList[0];
            if (toolCall.function && toolCall.function.arguments) {
              try {
                const args = typeof toolCall.function.arguments === 'string'
                  ? JSON.parse(toolCall.function.arguments)
                  : toolCall.function.arguments;
                if (args.query) {
                  lastQueryRef.current = args.query;
                  // Immediately fetch the expert info
                  axios.post('/api/pearch-search', { 
                    query: args.query, 
                    toolCallId: toolCall.id || 'manual' 
                  })
                  .then(res => {
                    if (res.data && res.data.formattedText) {
                      setExpertInfoText(res.data.formattedText);
                      // Parse the formatted text to create expert cards
                      const experts = parseExpertInfo(res.data.formattedText);
                      // Only add new experts that aren't already present (by name+title+linkedin)
                      setExpertCards(prev => {
                        const existing = new Set(prev.map(e => e.name + e.title + e.linkedin));
                        const newOnes = experts.filter(e => !existing.has(e.name + e.title + e.linkedin));
                        // Assign a unique floatId for animation phase
                        const withId = newOnes.map(e => ({ ...e, floatId: Math.random().toString(36).slice(2, 10) }));
                        return [...prev, ...withId];
                      });
                    }
                  })
                  .catch(err => {
                    console.error('Failed to fetch expert info:', err);
                    setExpertInfoText('');
                  });
                }
              } catch (e) {
                console.error('Error parsing tool call arguments:', e);
              }
            }
          }
        }
        // Handle tool call result messages (for cleanup or additional info)
        if (message.type === 'tool-result' || message.type === 'function-result') {
          console.log('Tool call result received:', message);
          // We already have the expert info from the tool call start, so just log
        }
      });

      // Handle speech events to detect when AI starts/stops speaking
      vapiRef.current.on('speech-start', () => {
        // When AI starts speaking, clear the current message for new response
        setCurrentAIMessage('');
        setIsAISpeaking(true);
      });

      vapiRef.current.on('speech-end', () => {
        // When AI stops speaking
        setIsAISpeaking(false);
      });

      // Add more event listeners for debugging
      vapiRef.current.on('call-start-progress', (progress) => {
        console.log('Call start progress:', progress);
      });

      vapiRef.current.on('call-start-failed', (failed) => {
        console.error('Call start failed:', failed);
        setError(`Call failed: ${failed.error}`);
        setIsLoading(false);
      });

    } catch (err) {
      console.error('Failed to initialize Vapi:', err);
      setError(`Failed to initialize Vapi: ${err}`);
    }

    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    };
  }, []);

  const handleStartCall = async () => {
    if (!vapiRef.current) {
      setError('Vapi not initialized. Please check your API key and assistant ID.');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Use assistant ID from environment variable
      const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
      await vapiRef.current.start(assistantId);
    } catch (error) {
      console.error('Failed to start call:', error);
      setError(`Failed to start call: ${error}`);
      setIsLoading(false);
    }
  };

  const handleEndCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
  };

  // Function to parse the formatted expert info text
  const parseExpertInfo = (formattedText: string) => {
    const experts = [];
    const lines = formattedText.split('\n');
    let currentExpert = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Expert ')) {
        if (currentExpert) {
          experts.push(currentExpert);
        }
        currentExpert = { name: '', title: '', linkedin: '' };
      } else if (line.startsWith('1. Full name: ') && currentExpert) {
        currentExpert.name = line.replace('1. Full name: ', '');
      } else if (line.startsWith('2. Title: ') && currentExpert) {
        currentExpert.title = line.replace('2. Title: ', '');
      } else if (line.startsWith('3. Linkedin url: ') && currentExpert) {
        currentExpert.linkedin = line.replace('3. Linkedin url: ', '');
      }
    }
    
    if (currentExpert) {
      experts.push(currentExpert);
    }
    
    return experts;
  };

  // Spiral positioning for persistent cards, only animate new ones
  useEffect(() => {
    if (!isCallActive || expertCards.length === 0) {
      positionsRef.current = new Map();
      setPositions([]);
      setLastBatchIds([]);
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const orbX = width / 2;
    const orbY = height / 2 - 100;
    const cardSize = 120;
    const baseRadius = 220;
    const step = 150;
    const xScale = 1.4;
    const goldenAngle = 137.5 * (Math.PI / 180);
    const total = expertCards.length;
    const newPositions: Array<{x: number, y: number, floatId: string, phase: number, isNew: boolean, newBatchIndex?: number}> = [];
    let newCardCount = 0;
    // Find new cards in this batch
    const prevIds = new Set(
      positionsRef.current ? Array.from(positionsRef.current.keys()).filter((id): id is string => typeof id === 'string') : []
    );
    const newBatchIds: string[] = [];
    for (let i = 0; i < total; i++) {
      const card = expertCards[i];
      let pos = positionsRef.current.get(card.floatId);
      if (!pos) {
        // New card, assign a new position
        const radius = baseRadius + step * Math.floor(i / 6);
        const angle = i * goldenAngle + Math.random() * 0.15;
        let x = orbX + xScale * radius * Math.cos(angle) - cardSize / 2;
        let y = orbY + radius * Math.sin(angle) - cardSize / 2;
        // Clamp so cards never go offscreen
        x = Math.max(8, Math.min(x, width - cardSize - 8));
        y = Math.max(8, Math.min(y, height - cardSize - 8));
        const phase = (i * 2 * Math.PI) / Math.max(1, total);
        pos = { x, y, floatId: card.floatId, phase, isNew: true };
        positionsRef.current.set(card.floatId, pos);
        newCardCount++;
        if (typeof card.floatId === 'string') {
          newBatchIds.push(card.floatId);
        }
      } else {
        pos = { ...pos, isNew: false };
      }
      newPositions.push(pos);
    }
    // Assign newBatchIndex for staggered animation
    if (newBatchIds.length > 0) {
      newPositions.forEach((p) => {
        if (p.isNew) {
          p.newBatchIndex = newBatchIds.indexOf(p.floatId);
        }
      });
    }
    setPositions(newPositions);
    setLastBatchIds(newBatchIds);
    // After animation, mark all as not new
    if (newCardCount > 0) {
      setTimeout(() => {
        setPositions(current => current.map(p => ({ ...p, isNew: false, newBatchIndex: undefined })));
      }, 800);
    }
  }, [expertCards, isCallActive]);

  // Re-randomize on window resize
  useEffect(() => {
    const handleResize = () => {
      if (expertCards.length > 0 && isCallActive) {
        setPositions([]);
        setTimeout(() => setPositions([]), 10); // force re-randomize
        setTimeout(() => setPositions([]), 100); // force re-randomize again
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [expertCards, isCallActive]);

  // Test button handler: add 4 John Does
  const handleAddTestJohnDoes = () => {
    const testExperts = Array.from({ length: 4 }).map((_, i) => ({
      name: `John Doe ${Math.floor(Math.random() * 10000)}`,
      title: 'Test Engineer',
      linkedin: `https://linkedin.com/in/johndoe${Math.floor(Math.random() * 10000)}`,
      floatId: Math.random().toString(36).slice(2, 10)
    }));
    setExpertCards(prev => [...prev, ...testExperts]);
    setIsCallActive(true); // Ensure floating UI is visible for testing
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
      position: 'relative'
    }}>
      {/* Test Button (top-right corner) - only if enabled in env */}
      {displayUiTesterButton && (
        <button
          onClick={handleAddTestJohnDoes}
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 2000,
            background: '#fff',
            color: '#111',
            border: '2px solid #000',
            borderRadius: '2rem',
            padding: '0.5rem 1.2rem',
            fontWeight: 700,
            fontSize: '1rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            opacity: 1,
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          + Add 4 John Does
        </button>
      )}

      {/* Circular Orb */}
      <div
        onClick={isCallActive ? handleEndCall : handleStartCall}
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
          transition: 'all 0.3s ease',
          background: isCallActive 
            ? 'linear-gradient(45deg, #000000, #1e3a8a, #065f46, #000000)' 
            : '#000000',
          backgroundSize: isCallActive ? '400% 400%' : '100% 100%',
          animation: isCallActive 
            ? isAISpeaking 
              ? 'gradient-shift 6s ease infinite, orb-pulse 1.5s ease infinite'
              : 'gradient-shift 6s ease infinite'
            : 'none',
          boxShadow: isCallActive 
            ? '0 0 30px rgba(30, 58, 138, 0.4), 0 0 60px rgba(6, 95, 70, 0.3), 0 0 90px rgba(0, 0, 0, 0.2)' 
            : '0 4px 20px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          zIndex: 10,
          marginBottom: '100px'
        }}
      >
        {/* Inner glow effect when active */}
        {isCallActive && (
          <div style={{
            position: 'absolute',
            width: '80%',
            height: '80%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            animation: 'pulse 2s infinite'
          }} />
        )}
      </div>

      {/* Current AI Message (Subtitle Style) */}
      {isCallActive && currentAIMessage && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '0.5rem',
          maxWidth: '80%',
          textAlign: 'center',
          fontSize: '1.2rem',
          zIndex: 1000,
          backdropFilter: 'blur(10px)'
        }}>
          {currentAIMessage}
        </div>
      )}

      {/* Expert Info (Floating Circular Cards) */}
      {isCallActive && expertCards.length > 0 && positions.length === expertCards.length && (
        <>
          {expertCards.map((expert, index) => {
            const pos = positions[index];
            return (
              <div
                key={expert.floatId}
                style={{
                  position: 'fixed',
                  left: pos.x,
                  top: pos.y,
                  zIndex: 999,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  minWidth: '120px',
                  pointerEvents: 'auto',
                  opacity: pos.isNew ? 0 : 1,
                  transform: pos.isNew ? 'scale(0.8)' : 'scale(1)',
                  animation: pos.isNew && typeof pos.newBatchIndex === 'number'
                    ? `fadeInScale 0.7s cubic-bezier(.4,2,.6,1) ${0.1 * pos.newBatchIndex}s forwards, floatHover 5s ease-in-out infinite ${pos.phase}s`
                    : `floatHover 5s ease-in-out infinite ${pos.phase}s`,
                  willChange: 'transform',
                }}
              >
                {/* Circular Avatar */}
                <div
                  onClick={() => {
                    if (expert.linkedin) {
                      window.open(expert.linkedin, '_blank');
                    }
                  }}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    border: '3px solid #000',
                    cursor: expert.linkedin ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: '#000',
                    marginBottom: '0.5rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  {expert.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                {/* Name */}
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  color: '#000',
                  marginBottom: '0.25rem',
                  maxWidth: '120px',
                  wordBreak: 'break-word',
                }}>
                  {expert.name}
                </div>
                {/* Title */}
                <div style={{
                  fontSize: '0.75rem',
                  color: '#666',
                  maxWidth: '120px',
                  wordBreak: 'break-word',
                }}>
                  {expert.title}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 0.5; }
        }
        
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes orb-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes fadeInScale {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes floatHover {
          0%   { transform: translate(0px, 0px) scale(1); }
          20%  { transform: translate(2.5px, -2px) scale(1.01); }
          40%  { transform: translate(-2px, 2.5px) scale(0.99); }
          60%  { transform: translate(-2.5px, -2px) scale(1.01); }
          80%  { transform: translate(2px, 2.5px) scale(0.99); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        html, body {
          overflow: hidden !important;
        }
        #__next, body > div:first-child {
          overflow: hidden !important;
        }
      `}</style>
    </div>
  );
}
