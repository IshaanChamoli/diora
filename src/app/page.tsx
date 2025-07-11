'use client';

import { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';

export default function Home() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAIMessage, setCurrentAIMessage] = useState<string>('');
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

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

      vapiRef.current.on('tool-call-result', (result) => {
        console.log('Pearch tool call result:', result);
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

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
      position: 'relative'
    }}>
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

      {/* CSS Animations */}
      <style jsx>{`
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
      `}</style>
    </div>
  );
}
