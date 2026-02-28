/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  Mic,
  Upload,
  Volume2,
  Activity,
  Waves,
  Settings2,
  Download,
  RefreshCw
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---
const EQ_BANDS = [
  { freq: 32, label: '32' },
  { freq: 64, label: '64' },
  { freq: 125, label: '125' },
  { freq: 250, label: '250' },
  { freq: 500, label: '500' },
  { freq: 1000, label: '1k' },
  { freq: 2000, label: '2k' },
  { freq: 4000, label: '4k' },
  { freq: 8000, label: '8k' },
  { freq: 16000, label: '16k' },
];

const GAIN_RANGE = { min: -12, max: 12 };

const EQ_PRESETS: Record<string, number[]> = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Classical': [0, 0, 0, 0, 0, 0, -6, -6, -6, -8],
  'Club': [0, 0, 2, 4, 4, 4, 2, 0, 0, 0],
  'Dance': [8, 6, 2, 0, 0, -4, -6, -6, 0, 0],
  'Bass': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  'Full Bass': [8, 8, 8, 4, 2, -6, -8, -10, -10, -10],
  'Full Treble': [-10, -10, -10, -8, -4, 4, 10, 12, 12, 12],
  'Laptop': [4, 8, 2, -4, -2, 0, 4, 8, 10, 12],
  'Large Hall': [8, 8, 4, 4, 0, -4, -4, -4, 0, 0],
  'Live': [-4, 0, 4, 6, 6, 6, 4, 2, 2, 2],
  'Party': [6, 6, 0, 0, 0, 0, 0, 0, 6, 6],
  'Jazz': [4, 2, 0, 2, -2, -2, 0, 2, 4, 4],
  'Pop': [-2, 4, 6, 4, -2, -2, -2, -2, -2, -2],
  'Reggae': [0, 0, -2, -4, 0, 4, 4, 0, 0, 0],
  'Rock': [6, 4, -6, -8, -2, 4, 8, 10, 10, 10],
  'Soft': [4, 2, 0, -2, -2, 0, 2, 4, 8, 10],
  'Ska': [-2, -4, -4, -2, 4, 6, 8, 10, 10, 8],
  'Soft Rock': [4, 4, 2, 0, -4, -6, -4, -2, 2, 6],
  'Techno': [6, 4, 0, -6, -6, -2, 6, 8, 8, 6],
};

const SAMPLE_CLIPS = [
  { name: 'Dog Bark', url: '/audio/dog_bark.wav', label: '🐶 Dog Bark' },
  { name: 'Chirping Birds', url: '/audio/chirping_birds.wav', label: '🐦 Chirping Birds' },
  { name: 'Vacuum Cleaner', url: '/audio/vacuum_cleaner.wav', label: '🧹 Vacuum Cleaner' },
  { name: 'Thunderstorm', url: '/audio/thunderstorm.wav', label: '⛈️ Thunderstorm' },
  { name: 'Can Opening', url: '/audio/can_opening.wav', label: '🥫 Can Opening' },
];

// --- Components ---

export default function App() {
  // Audio Context & Nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const streamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  // Use ref for audioBuffer so audio functions always see latest value
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [eqGains, setEqGains] = useState<number[]>(new Array(EQ_BANDS.length).fill(0));
  const [viewMode, setViewMode] = useState<'waveform' | 'spectrogram' | 'waterfall'>('waveform');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [recordedObjectUrl, setRecordedObjectUrl] = useState<string | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep audioBufferRef in sync with state
  useEffect(() => {
    audioBufferRef.current = audioBuffer;
  }, [audioBuffer]);

  // --- Audio Engine Initialization ---
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;

      eqFiltersRef.current = EQ_BANDS.map((band, i) => {
        const filter = audioCtxRef.current!.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = band.freq;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        return filter;
      });

      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.gain.value = volume;

      // Chain: source -> EQ filters -> analyser -> gain -> destination
      for (let i = 0; i < eqFiltersRef.current.length - 1; i++) {
        eqFiltersRef.current[i].connect(eqFiltersRef.current[i + 1]);
      }

      eqFiltersRef.current[eqFiltersRef.current.length - 1].connect(analyserRef.current);
      analyserRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioCtxRef.current.destination);
    }
  }, [volume]);

  // --- Helper: safely disconnect source nodes ---
  const cleanupSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current.stop();
      } catch (e) { /* already stopped */ }
      sourceNodeRef.current = null;
    }
    if (streamSourceRef.current) {
      try {
        streamSourceRef.current.disconnect();
      } catch (e) { /* ignore */ }
      streamSourceRef.current = null;
    }
  }, []);

  // --- Visualization Loop ---
  const draw = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bufferLength = analyserRef.current.frequencyBinCount;

    // Update Current Time if playing
    if (isPlaying && audioCtxRef.current) {
      const elapsed = audioCtxRef.current.currentTime - playbackStartTimeRef.current;
      setCurrentTime(Math.min(elapsed, duration));
      if (duration > 0 && elapsed >= duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        pausedAtRef.current = 0;
      }
    }

    if (viewMode === 'waveform') {
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const x = (width / 10) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        const y = (height / 10) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00FF00';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00FF00';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

    } else if (viewMode === 'spectrogram') {
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    } else if (viewMode === 'waterfall') {
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
        offscreenCanvasRef.current.width = width;
        offscreenCanvasRef.current.height = height;
      }

      const oCanvas = offscreenCanvasRef.current;
      const oCtx = oCanvas.getContext('2d')!;

      // Shift existing image down
      oCtx.drawImage(oCanvas, 0, 1);

      // Draw new line at the top
      const sliceWidth = width / bufferLength;
      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const hue = 240 - (value / 255) * 240;
        oCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        oCtx.fillRect(i * sliceWidth, 0, sliceWidth, 1);
      }

      ctx.drawImage(oCanvas, 0, 0);
    }

    // Draw EQ Curve (Subtle Overlay)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < EQ_BANDS.length; i++) {
      const x = (i / (EQ_BANDS.length - 1)) * width;
      const y = height / 2 - (eqGains[i] / GAIN_RANGE.max) * (height / 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '10px monospace';
    ctx.fillText('EQ CURVE', 10, height - 10);

    animationFrameRef.current = requestAnimationFrame(draw);
  }, [viewMode, isPlaying, duration, eqGains]);

  useEffect(() => {
    if (isPlaying || isRecording) {
      animationFrameRef.current = requestAnimationFrame(draw);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, isRecording, draw]);

  // Clear offscreen canvas when switching modes
  useEffect(() => {
    if (offscreenCanvasRef.current) {
      const ctx = offscreenCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0A0A0A';
        ctx.fillRect(0, 0, offscreenCanvasRef.current.width, offscreenCanvasRef.current.height);
      }
    }
  }, [viewMode]);

  // --- Core Audio Functions ---
  // These use refs instead of state to avoid stale closure issues.

  const stopPlayback = useCallback(() => {
    cleanupSource();

    // Stop MediaRecorder if running
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) { /* ignore */ }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsPlaying(false);
    setIsRecording(false);
    setCurrentTime(0);
    pausedAtRef.current = 0;
  }, [cleanupSource]);

  const startPlayback = useCallback((bufferOverride?: AudioBuffer) => {
    const buffer = bufferOverride || audioBufferRef.current;
    if (!buffer || !audioCtxRef.current) {
      console.warn('startPlayback: No buffer or audio context available');
      return;
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    // Clean up any existing sources
    cleanupSource();

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(eqFiltersRef.current[0]);

    source.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      pausedAtRef.current = 0;
      sourceNodeRef.current = null;
    };

    const offset = pausedAtRef.current;
    source.start(0, offset);
    playbackStartTimeRef.current = audioCtxRef.current.currentTime - offset;
    sourceNodeRef.current = source;
    setIsPlaying(true);
  }, [cleanupSource]);

  const pausePlayback = useCallback(() => {
    if (sourceNodeRef.current && audioCtxRef.current) {
      pausedAtRef.current = audioCtxRef.current.currentTime - playbackStartTimeRef.current;
    }
    cleanupSource();
    setIsPlaying(false);
  }, [cleanupSource]);

  // --- Actions ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopPlayback();
    initAudio();
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await audioCtxRef.current!.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      setDuration(decodedBuffer.duration);
      setCurrentTime(0);
      pausedAtRef.current = 0;
    } catch (err) {
      console.error('Error loading audio file:', err);
      alert(`Failed to load audio file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSampleSelect = async (url: string, name: string) => {
    if (!url) return;
    console.log(`Loading sample: ${name} from ${url}`);
    setIsLoadingSample(true);
    stopPlayback();
    initAudio();

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status} at ${url}`);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await audioCtxRef.current!.decodeAudioData(arrayBuffer);

      console.log('Audio loaded successfully.');
      setAudioBuffer(decodedBuffer);
      setFileName(name);
      setDuration(decodedBuffer.duration);
      setCurrentTime(0);
      pausedAtRef.current = 0;

      // Auto-start playback — pass buffer directly to avoid stale ref
      startPlayback(decodedBuffer);

    } catch (err) {
      console.error('Error loading sample:', err);
      alert(`Failed to load sample audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoadingSample(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopPlayback();
      return;
    }

    initAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Clean up any existing sources
      cleanupSource();

      // Setup live analysis source
      const source = audioCtxRef.current!.createMediaStreamSource(stream);
      source.connect(eqFiltersRef.current[0]);
      streamSourceRef.current = source;

      // Setup MediaRecorder to save audio
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedObjectUrl(url);
        setFileName(`Recording_${new Date().toLocaleTimeString().replace(/:/g, '-')}.webm`);

        // Convert to AudioBuffer for replay
        try {
          if (!audioCtxRef.current) return;
          const ab = await blob.arrayBuffer();
          const decodedBuffer = await audioCtxRef.current.decodeAudioData(ab);
          setAudioBuffer(decodedBuffer);
          setDuration(decodedBuffer.duration);
          setCurrentTime(0);
          pausedAtRef.current = 0;
        } catch (err) {
          console.error('Failed to decode recorded stream to AudioBuffer:', err);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      if (audioCtxRef.current!.state === 'suspended') {
        audioCtxRef.current!.resume();
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Microphone access denied or not available.');
    }
  };

  const updateEqGain = (index: number, value: number) => {
    const newGains = [...eqGains];
    newGains[index] = value;
    setEqGains(newGains);

    if (eqFiltersRef.current[index]) {
      eqFiltersRef.current[index].gain.setTargetAtTime(value, audioCtxRef.current?.currentTime || 0, 0.1);
    }
  };

  const updateVolume = (value: number) => {
    setVolume(value);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(value, audioCtxRef.current?.currentTime || 0, 0.1);
    }
  };

  const resetEq = () => {
    const resetGains = new Array(EQ_BANDS.length).fill(0);
    setEqGains(resetGains);
    eqFiltersRef.current.forEach((filter) => {
      filter.gain.setTargetAtTime(0, audioCtxRef.current?.currentTime || 0, 0.1);
    });
  };

  const applyPreset = (presetName: string) => {
    const gains = EQ_PRESETS[presetName];
    if (!gains) return;

    setEqGains(gains);
    gains.forEach((gain, i) => {
      if (eqFiltersRef.current[i]) {
        eqFiltersRef.current[i].gain.setTargetAtTime(gain, audioCtxRef.current?.currentTime || 0, 0.1);
      }
    });
  };

  // --- UI ---
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-green-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#111] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.4)]">
            <Activity className="text-black w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SonicWave</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono">Precision Audio Engine v2.5</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono ml-2">Samples:</span>
            <select
              className="bg-transparent text-sm font-medium outline-none cursor-pointer pr-2"
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const sample = SAMPLE_CLIPS.find(s => s.url === val);
                if (sample) handleSampleSelect(sample.url, sample.name);
                e.target.value = "";
              }}
              defaultValue=""
              disabled={isLoadingSample}
            >
              <option value="" disabled className="bg-[#111]">Select Sample...</option>
              {SAMPLE_CLIPS.map(sample => (
                <option key={sample.url} value={sample.url} className="bg-[#111]">
                  {sample.label}
                </option>
              ))}
            </select>
            {isLoadingSample && <RefreshCw className="w-3 h-3 animate-spin text-green-500 mr-2" />}
          </div>

          <label className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/10 group">
            <Upload className="w-4 h-4 text-white/60 group-hover:text-white" />
            <span className="text-sm font-medium">Load Audio</span>
            <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={toggleRecording}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full transition-all border",
              isRecording
                ? "bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
            )}
          >
            <Mic className={cn("w-4 h-4", isRecording && "animate-pulse")} />
            <span className="text-sm font-medium">{isRecording ? 'Stop Recording' : 'Live Input'}</span>
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visualizer & Controls */}
        <div className="lg:col-span-8 space-y-6">
          {/* Main Display */}
          <section className="bg-[#151619] rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              <button
                onClick={() => setViewMode('waveform')}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === 'waveform' ? "bg-green-500 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
                title="Waveform"
              >
                <Waves className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('spectrogram')}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === 'spectrogram' ? "bg-green-500 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
                title="Frequency Spectrum"
              >
                <Activity className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('waterfall')}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === 'waterfall' ? "bg-green-500 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
                title="Waterfall Spectrogram"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", isPlaying || isRecording ? "bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" : "bg-white/20")} />
                <span className="text-xs font-mono text-white/60 uppercase tracking-widest">
                  {isRecording ? 'Live Signal' : fileName || 'No Track Loaded'}
                </span>
                {(isPlaying || isRecording) && (
                  <span className="text-[10px] font-mono text-green-500/40 animate-pulse ml-2">
                    ANALYSIS ACTIVE
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-green-500/80">
                {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')} / {Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={800}
              height={320}
              className="w-full h-[320px] block cursor-crosshair"
            />

            {isLoadingSample && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4 z-20">
                <RefreshCw className="w-10 h-10 text-green-500 animate-spin" />
                <p className="text-sm font-mono text-green-500 uppercase tracking-widest animate-pulse">
                  Decoding Audio Signal...
                </p>
              </div>
            )}

            {/* Playback Progress */}
            {audioBuffer && !isRecording && (
              <div
                className="h-1 bg-white/5 relative cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const pct = x / rect.width;
                  const newTime = pct * duration;
                  pausedAtRef.current = newTime;
                  setCurrentTime(newTime);
                  if (isPlaying) startPlayback();
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-green-500 shadow-[0_0_10px_#22c55e] transition-all duration-100"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            )}
          </section>

          {/* Playback Controls */}
          <section className="bg-[#151619] p-6 rounded-2xl border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => isPlaying ? pausePlayback() : startPlayback()}
                  disabled={!audioBuffer || isRecording}
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
                    isPlaying
                      ? "bg-white text-black hover:scale-105"
                      : audioBuffer
                        ? "bg-green-500 text-black hover:scale-110 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                        : "bg-white/5 text-white/20 border border-white/10"
                  )}
                  title={isPlaying ? "Pause" : "Play / Run Analysis"}
                >
                  {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                </button>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-white/40 uppercase tracking-tighter">
                  {isPlaying ? 'Running' : audioBuffer ? 'Run Analysis' : 'Load audio to start'}
                </div>
              </div>
              <button
                onClick={stopPlayback}
                disabled={(!isPlaying && !isRecording)}
                className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-20"
                title="Stop"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            </div>

            <div className="flex items-center gap-6 flex-1 max-w-md px-8">
              <Volume2 className="w-5 h-5 text-white/40" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => updateVolume(parseFloat(e.target.value))}
                className="flex-1 accent-green-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs font-mono text-white/40 w-8">{(volume * 100).toFixed(0)}%</span>
            </div>
          </section>
        </div>

        {/* Right Column: Equalizer */}
        <div className="lg:col-span-4">
          <section className="bg-[#151619] rounded-2xl border border-white/5 h-full flex flex-col">
            <div className="p-6 border-b border-white/5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-green-500" />
                  <h2 className="font-bold tracking-tight">Equalizer</h2>
                </div>
                <button
                  onClick={resetEq}
                  className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Preset:</span>
                <select
                  className="bg-transparent text-xs font-medium outline-none cursor-pointer flex-1"
                  onChange={(e) => applyPreset(e.target.value)}
                  value={Object.keys(EQ_PRESETS).find(key => JSON.stringify(EQ_PRESETS[key]) === JSON.stringify(eqGains)) || ""}
                >
                  <option value="" disabled className="bg-[#111]">Custom</option>
                  {Object.keys(EQ_PRESETS).map(name => (
                    <option key={name} value={name} className="bg-[#111]">{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 p-6 flex items-end justify-between gap-2 overflow-x-auto">
              {EQ_BANDS.map((band, i) => (
                <div key={band.freq} className="flex flex-col items-center gap-4 group h-full">
                  <div className="relative flex-1 w-8 flex justify-center">
                    {/* Track Background */}
                    <div className="absolute inset-y-0 w-1 bg-white/5 rounded-full" />

                    {/* Slider Input */}
                    <input
                      type="range"
                      min={GAIN_RANGE.min}
                      max={GAIN_RANGE.max}
                      step="0.5"
                      value={eqGains[i]}
                      onChange={(e) => updateEqGain(i, parseFloat(e.target.value))}
                      style={{
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                        appearance: 'none',
                        background: 'transparent',
                        width: '32px',
                        height: '100%',
                        cursor: 'pointer'
                      }}
                      className="relative z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_#22c55e] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
                    />

                    {/* Value Indicator */}
                    <div
                      className="absolute left-full ml-1 text-[8px] font-mono text-green-500/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ bottom: `${((eqGains[i] - GAIN_RANGE.min) / (GAIN_RANGE.max - GAIN_RANGE.min)) * 100}%` }}
                    >
                      {eqGains[i] > 0 ? '+' : ''}{eqGains[i]}dB
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] font-mono text-white/40 group-hover:text-white transition-colors">{band.label}</div>
                    <div className="text-[8px] text-white/20 uppercase tracking-tighter">Hz</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-black/20 rounded-b-2xl">
              <div className="grid grid-cols-2 gap-3">
                {recordedObjectUrl && (
                  <a
                    href={recordedObjectUrl}
                    download={fileName || "SonicWave_Recording.webm"}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 text-xs font-medium hover:bg-green-500/20 hover:border-green-500/40 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download Recording
                  </a>
                )}
                {!recordedObjectUrl && (
                  <button className="flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium hover:bg-white/10 transition-colors">
                    <Download className="w-3 h-3" />
                    Save Preset
                  </button>
                )}
                <button className="flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium hover:bg-white/10 transition-colors">
                  <Settings2 className="w-3 h-3" />
                  Advanced
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-white/5 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Sample Rate</span>
            <span className="text-[10px] font-mono text-green-500/60">{audioCtxRef.current?.sampleRate || '---'} Hz</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Buffer Size</span>
            <span className="text-[10px] font-mono text-green-500/60">2048</span>
          </div>
        </div>
        <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest flex items-center gap-4">
          <button
            onClick={() => {
              if (audioCtxRef.current) {
                audioCtxRef.current.close().then(() => {
                  audioCtxRef.current = null;
                  initAudio();
                  alert('Audio Engine Reset Successful');
                });
              }
            }}
            className="hover:text-white transition-colors border border-white/10 px-2 py-0.5 rounded"
          >
            Reset Engine
          </button>
          <span>Engine Status: <span className={cn(audioCtxRef.current ? "text-green-500" : "text-white/20")}>{audioCtxRef.current?.state || 'Idle'}</span></span>
        </div>
      </footer>
    </div>
  );
}
