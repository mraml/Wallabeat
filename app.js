import React, { useState, useEffect, useRef, useCallback } from 'react';

// Main App component for the entire drum machine and sequencer
const App = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [selectedOscillator, setSelectedOscillator] = useState('osc1'); // 'osc1' or 'osc2'
  const [sequence, setSequence] = useState(Array.from({ length: 8 }, () => Array(16).fill(false)));
  const [isMuted, setIsMuted] = useState(Array(8).fill(false));
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [swing, setSwing] = useState(0);
  const [masterOverdrive, setMasterOverdrive] = useState(0);
  const [masterCompression, setMasterCompression] = useState(0);
  const [masterReverbDecay, setMasterReverbDecay] = useState(0.5); // Initial reverb decay value
  const [isAudioReady, setIsAudioReady] = useState(false); // State for checking if audio context is ready
  const [isInitializing, setIsInitializing] = useState(false); // State to handle loading
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);

  const audioCtxRef = useRef(null);
  const whiteNoiseBufferRef = useRef(null);
  const masterGainRef = useRef(null);
  const distortionRef = useRef(null);
  const compressorRef = useRef(null);
  const sequencerTimeoutRef = useRef(null);
  const reverbRef = useRef(null); // Ref for the global reverb effect

  // A new ref to hold all the persistent audio nodes for each of the 8 tracks
  const trackNodesRef = useRef(null);

  // Define a bank of synth presets with delay/reverb removed
  const presets = [
    {
      name: 'Kick 1',
      oscillator: 'sine', pitch: -700, vcaAttack: 0.005, vcaDecay: 0.2, vcaSustain: 0, vcaRelease: 0.1,
      lpFilter: 500, hpFilter: 20, filterRes: 10, oscillator2: 'sine', pitch2: -1200, blend: 0.5,
      lowGain: 5, midGain: 0, highGain: -5, detune: 0, detune2: 0,
      filterEnvAmount: 0, filterDecay: 0.5, lfoRate: 5, lfoDepth: 0, lfoTarget: 'pitch', pan: 0,
    },
    {
      name: 'Snare 1',
      oscillator: 'noise', pitch: 0, vcaAttack: 0.01, vcaDecay: 0.3, vcaSustain: 0, vcaRelease: 0.1,
      lpFilter: 10000, hpFilter: 5000, filterRes: 5, oscillator2: 'noise', pitch2: 0, blend: 0.7,
      lowGain: -3, midGain: 5, highGain: 0, detune: 0, detune2: 0,
      filterEnvAmount: 0, filterDecay: 0.5, lfoRate: 5, lfoDepth: 0, lfoTarget: 'pitch', pan: 0,
    },
    {
      name: 'Hi-hat 1',
      oscillator: 'noise', pitch: 1200, vcaAttack: 0.001, vcaDecay: 0.1, vcaSustain: 0, vcaRelease: 0.05,
      lpFilter: 20000, hpFilter: 8000, filterRes: 2, oscillator2: 'noise', pitch2: 1800, blend: 0.4,
      lowGain: -10, midGain: -5, highGain: 8, detune: 0, detune2: 0,
      filterEnvAmount: 0, filterDecay: 0.5, lfoRate: 5, lfoDepth: 0, lfoTarget: 'pitch', pan: 0,
    },
    {
      name: 'Clap 1',
      oscillator: 'noise', pitch: 0, vcaAttack: 0.01, vcaDecay: 0.5, vcaSustain: 0, vcaRelease: 0.2,
      lpFilter: 8000, hpFilter: 2000, filterRes: 5, oscillator2: 'noise', pitch2: 0, blend: 0.5,
      lowGain: -5, midGain: 5, highGain: 5, detune: 0, detune2: 0,
      filterEnvAmount: 0, filterDecay: 0.5, lfoRate: 5, lfoDepth: 0, lfoTarget: 'pitch', pan: 0,
    },
    {
      name: 'Synth Bass',
      oscillator: 'triangle', pitch: -1200, vcaAttack: 0.01, vcaDecay: 0.5, vcaSustain: 0.7, vcaRelease: 0.5,
      lpFilter: 5000, hpFilter: 20, filterRes: 5, oscillator2: 'sawtooth', pitch2: -1200, blend: 0.6,
      lowGain: 8, midGain: 2, highGain: -5, detune: 0, detune2: 0,
      filterEnvAmount: 0, filterDecay: 0.5, lfoRate: 5, lfoDepth: 0, lfoTarget: 'pitch', pan: 0,
    },
    {
      name: 'Percussion 1',
      oscillator: 'sine', pitch: 100, vcaAttack: 0.005, vcaDecay: 0.3, vcaSustain: 0, vcaRelease: 0.1,
      lpFilter: 2000, hpFilter: 20, filterRes: 15, oscillator2: 'triangle', pitch2: 200, blend: 0.2,
      lowGain: 0, midGain: 5, highGain: 0, detune: 0, detune2: 0,
      filterEnvAmount: 0, filterDecay: 0.5, lfoRate: 5, lfoDepth: 0, lfoTarget: 'pitch', pan: 0.5,
    },
    {
      name: '808 Kick',
      oscillator: 'sine', pitch: -1200, vcaAttack: 0.005, vcaDecay: 1.0, vcaSustain: 0, vcaRelease: 0.1,
      lpFilter: 200, hpFilter: 20, filterRes: 15, oscillator2: 'sine', pitch2: -1200, blend: 0.5,
      lowGain: 10, midGain: -5, highGain: -10, detune: 0, detune2: 0,
      filterEnvAmount: 0, filterDecay: 0.5, lfoRate: 5, lfoDepth: 0, lfoTarget: 'pitch', pan: 0,
    },
    {
      name: 'Open Hat',
      oscillator: 'noise', pitch: 1800, vcaAttack: 0.01, vcaDecay: 0.5, vcaSustain: 0.5, vcaRelease: 0.5,
      lpFilter: 20000, hpFilter: 10000, filterRes: 1, oscillator2: 'noise', pitch2: 2000, blend: 0.5,
      lowGain: -10, midGain: -5, highGain: 8, detune: 0, detune2: 0,
      filterEnvAmount: 0, filterDecay: 0.5, lfoRate: 5, lfoDepth: 0, lfoTarget: 'pitch', pan: 0,
    },
  ];

  // Synth parameters for each of the 8 polyphonic voices
  const [voiceParameters, setVoiceParameters] = useState(() => {
    // Initialize with a preset for each track
    return presets.slice(0, 8).map(preset => ({ ...preset }));
  });

  // Function to load a preset into a specific track
  const loadPreset = useCallback((presetIndex, trackIndex) => {
    const preset = presets[presetIndex];
    if (!preset) return;
    setVoiceParameters(prev => {
        const newParams = [...prev];
        newParams[trackIndex] = { ...preset };
        return newParams;
    });
  }, [presets]);

  // Handler for changing the preset via the left/right buttons
  const handlePresetChange = useCallback((direction) => {
    let newIndex = currentPresetIndex + direction;
    if (newIndex >= presets.length) {
        newIndex = 0;
    } else if (newIndex < 0) {
        newIndex = presets.length - 1;
    }
    setCurrentPresetIndex(newIndex);
    loadPreset(newIndex, selectedTrackIndex);
  }, [currentPresetIndex, presets, selectedTrackIndex, loadPreset]);

  // Handler for the new audition button
  const handleAudition = useCallback(() => {
    if (!isAudioReady) return;
    // Play the sound for the currently selected track
    playSound(selectedTrackIndex, 1);
  }, [isAudioReady, selectedTrackIndex]);

  const makeDistortionCurve = useCallback((amount) => {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }, []);

  // Initialize the audio engine and all persistent nodes on first user interaction
  const initializeAudio = useCallback(async () => {
    if (isAudioReady || isInitializing) return;

    setIsInitializing(true);
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
        console.error("Web Audio API not supported in this browser.");
        setIsInitializing(false);
        return;
    }

    try {
      audioCtxRef.current = new AudioContext();

      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      const bufferSize = audioCtxRef.current.sampleRate * 2;
      whiteNoiseBufferRef.current = audioCtxRef.current.createBuffer(1, bufferSize, audioCtxRef.current.sampleRate);
      const output = whiteNoiseBufferRef.current.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      // Create persistent nodes
      masterGainRef.current = audioCtxRef.current.createGain();
      distortionRef.current = audioCtxRef.current.createWaveShaper();
      compressorRef.current = audioCtxRef.current.createDynamicsCompressor();
      reverbRef.current = audioCtxRef.current.createConvolver();

      // Create an impulse response for the reverb
      const createImpulse = () => {
        const length = audioCtxRef.current.sampleRate * masterReverbDecay;
        const impulse = audioCtxRef.current.createBuffer(2, length, audioCtxRef.current.sampleRate);
        const impulseL = impulse.getChannelData(0);
        const impulseR = impulse.getChannelData(1);
        for (let i = 0; i < length; i++) {
          const x = i / length;
          impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 3);
          impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 3);
        }
        return impulse;
      };

      reverbRef.current.buffer = createImpulse();

      // Connect main signal path: Master Gain -> Distortion -> Compressor -> Reverb -> Destination
      masterGainRef.current.connect(distortionRef.current);
      distortionRef.current.connect(compressorRef.current);
      compressorRef.current.connect(reverbRef.current);
      reverbRef.current.connect(audioCtxRef.current.destination);

      // Initialize all track-specific nodes once
      trackNodesRef.current = Array.from({ length: 8 }, () => {
        const oscMixer = audioCtxRef.current.createGain();
        const lpFilter = audioCtxRef.current.createBiquadFilter();
        const hpFilter = audioCtxRef.current.createBiquadFilter();
        const lowFilter = audioCtxRef.current.createBiquadFilter();
        const midFilter = audioCtxRef.current.createBiquadFilter();
        const highFilter = audioCtxRef.current.createBiquadFilter();
        const vcaGain = audioCtxRef.current.createGain();
        const panner = audioCtxRef.current.createStereoPanner();
        const lfo = audioCtxRef.current.createOscillator();
        const lfoGain = audioCtxRef.current.createGain();

        // Connect main signal path: Mixer -> Filters -> EQ -> VCA -> Panner
        oscMixer.connect(lpFilter);
        lpFilter.connect(hpFilter);
        hpFilter.connect(lowFilter);
        lowFilter.connect(midFilter);
        midFilter.connect(highFilter);
        highFilter.connect(vcaGain);
        vcaGain.connect(panner);

        // Connect LFO
        lfo.connect(lfoGain);
        lfo.start();

        // Simplified effects routing: Panner connects directly to master for now.
        panner.connect(masterGainRef.current);

        return {
          oscMixer, lpFilter, hpFilter, lowFilter, midFilter, highFilter, vcaGain, panner, lfo, lfoGain,
        };
      });

      setIsAudioReady(true);
    } catch (e) {
      console.error("Error initializing audio context:", e);
      setIsInitializing(false);
      setIsAudioReady(false);
    } finally {
      setIsInitializing(false);
    }
  }, [isAudioReady, isInitializing, masterReverbDecay]);

  // Update master controls (volume, overdrive, compression)
  useEffect(() => {
    if (!isAudioReady) return;
    const now = audioCtxRef.current.currentTime;
    if (masterGainRef.current) masterGainRef.current.gain.setValueAtTime(masterVolume, now);
    if (distortionRef.current) distortionRef.current.curve = makeDistortionCurve(masterOverdrive * 100);
    if (compressorRef.current) compressorRef.current.threshold.setValueAtTime(0 - (masterCompression * 30), now);
  }, [masterVolume, masterOverdrive, masterCompression, makeDistortionCurve, isAudioReady]);

  // Update reverb decay when the knob is changed
  useEffect(() => {
    if (!isAudioReady || !reverbRef.current) return;
    // Recreate the impulse response with the new decay value
    const createImpulse = () => {
        const length = audioCtxRef.current.sampleRate * masterReverbDecay;
        const impulse = audioCtxRef.current.createBuffer(2, length, audioCtxRef.current.sampleRate);
        const impulseL = impulse.getChannelData(0);
        const impulseR = impulse.getChannelData(1);
        for (let i = 0; i < length; i++) {
            const x = i / length;
            impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 3);
            impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 3);
        }
        return impulse;
    };
    reverbRef.current.buffer = createImpulse();
  }, [masterReverbDecay, isAudioReady]);

  // The original useEffect for track nodes is now much simpler
  useEffect(() => {
    if (!isAudioReady || !trackNodesRef.current) return;

    trackNodesRef.current.forEach((nodes, trackIndex) => {
      const params = voiceParameters[trackIndex];
      const now = audioCtxRef.current.currentTime;

      // Update filter parameters
      nodes.lpFilter.type = 'lowpass';
      nodes.lpFilter.Q.setValueAtTime(params.filterRes, now);
      nodes.lpFilter.frequency.setValueAtTime(params.lpFilter, now);
      nodes.hpFilter.type = 'highpass';
      nodes.hpFilter.frequency.setValueAtTime(params.hpFilter, now);

      // Update EQ
      nodes.lowFilter.gain.setValueAtTime(params.lowGain, now);
      nodes.midFilter.gain.setValueAtTime(params.midGain, now);
      nodes.highFilter.gain.setValueAtTime(params.highGain, now);
      nodes.lowFilter.type = 'peaking';
      nodes.lowFilter.frequency.setValueAtTime(200, now);
      nodes.midFilter.type = 'peaking';
      nodes.midFilter.frequency.setValueAtTime(1000, now);
      nodes.highFilter.type = 'peaking';
      nodes.highFilter.frequency.setValueAtTime(4000, now);

      // Update LFO
      nodes.lfo.frequency.setValueAtTime(params.lfoRate, now);
      nodes.lfoGain.gain.setValueAtTime(params.lfoDepth, now);
      nodes.lfoGain.disconnect();
      if (params.lfoTarget === 'filter') {
          nodes.lfoGain.connect(nodes.lpFilter.frequency);
      }

      // Update Panner
      nodes.panner.pan.setValueAtTime(params.pan, now);
    });

  }, [voiceParameters, isAudioReady]);

  // NEW playSound function creates and stops sources dynamically and reliably
  const playSound = useCallback((trackIndex, velocity = 1) => {
    if (!isAudioReady || isMuted[trackIndex]) {
      return;
    }

    try {
      const params = voiceParameters[trackIndex];
      const nodes = trackNodesRef.current[trackIndex];
      const now = audioCtxRef.current.currentTime;
      const duration = params.vcaAttack + params.vcaDecay + params.vcaRelease;
      const releaseTime = now + duration;

      // Create new sound sources dynamically
      const oscMixer = audioCtxRef.current.createGain();
      const gain1 = audioCtxRef.current.createGain();
      const gain2 = audioCtxRef.current.createGain();

      const source1 = params.oscillator === 'noise'
          ? audioCtxRef.current.createBufferSource()
          : audioCtxRef.current.createOscillator();
      const source2 = params.oscillator2 === 'noise'
          ? audioCtxRef.current.createBufferSource()
          : audioCtxRef.current.createOscillator();

      // Configure and connect sources
      if (params.oscillator === 'noise') {
          source1.buffer = whiteNoiseBufferRef.current;
          source1.loop = true; // Use a looping buffer for noise
      } else {
          source1.type = params.oscillator;
      }
      if (params.oscillator2 === 'noise') {
          source2.buffer = whiteNoiseBufferRef.current;
          source2.loop = true;
      } else {
          source2.type = params.oscillator2;
      }

      source1.connect(gain1);
      source2.connect(gain2);
      gain1.connect(oscMixer);
      gain2.connect(oscMixer);
      gain1.gain.setValueAtTime(1 - params.blend, now);
      gain2.gain.setValueAtTime(params.blend, now);

      // Connect the mixer to the track's filter chain
      oscMixer.connect(nodes.lpFilter);

      // Update pitch and LFO modulation
      const baseFreq = 100;
      const pitchRatio1 = Math.pow(2, (params.pitch + params.detune) / 1200);
      const pitchRatio2 = Math.pow(2, (params.pitch2 + params.detune2) / 1200);

      if (source1.frequency) { // Check if it's an oscillator
          source1.frequency.setValueAtTime(baseFreq * pitchRatio1, now);
          if (params.lfoTarget === 'pitch') {
              nodes.lfoGain.connect(source1.frequency);
          }
      }
      if (source2.frequency) { // Check if it's an oscillator
          source2.frequency.setValueAtTime(baseFreq * pitchRatio2, now);
          if (params.lfoTarget === 'pitch') {
              nodes.lfoGain.connect(source2.frequency);
          }
      }

      // VCA Envelope
      nodes.vcaGain.gain.cancelScheduledValues(now);
      nodes.vcaGain.gain.setValueAtTime(0, now);
      nodes.vcaGain.gain.linearRampToValueAtTime(velocity, now + params.vcaAttack);
      nodes.vcaGain.gain.linearRampToValueAtTime(params.vcaSustain * velocity, now + params.vcaAttack + params.vcaDecay);
      nodes.vcaGain.gain.linearRampToValueAtTime(0, now + params.vcaAttack + params.vcaDecay + params.vcaRelease);

      // Filter Envelope
      if (params.filterEnvAmount > 0) {
          nodes.lpFilter.frequency.cancelScheduledValues(now);
          const targetFrequency = Math.min(22050, params.lpFilter + params.filterEnvAmount);
          nodes.lpFilter.frequency.setValueAtTime(params.lpFilter, now);
          nodes.lpFilter.frequency.linearRampToValueAtTime(targetFrequency, now + params.vcaAttack);
          nodes.lpFilter.frequency.linearRampToValueAtTime(params.lpFilter, now + params.vcaAttack + params.filterDecay);
      }

      // Start sources and schedule their stopping
      source1.start(now);
      source2.start(now);
      source1.stop(releaseTime);
      source2.stop(releaseTime);

      // Disconnect sources to clean up
      setTimeout(() => {
          source1.disconnect();
          source2.disconnect();
          oscMixer.disconnect();
          // Also disconnect LFO from sources
          if (params.lfoTarget === 'pitch') {
              nodes.lfoGain.disconnect(source1.frequency);
              nodes.lfoGain.disconnect(source2.frequency);
          }
      }, (releaseTime - now) * 1000 + 50);
    } catch (e) {
      console.error("Error in playSound:", e);
    }
  }, [voiceParameters, isMuted, isAudioReady, whiteNoiseBufferRef]);

  useEffect(() => {
    if (!isPlaying || !isAudioReady) {
      clearTimeout(sequencerTimeoutRef.current);
      return;
    }

    const stepTime = 60000 / (bpm * 4);

    const playStep = (stepIndex) => {
        setCurrentStep(stepIndex);
        for (let trackIndex = 0; trackIndex < 8; trackIndex++) {
            if (sequence[trackIndex][stepIndex]) {
                playSound(trackIndex, 1);
            }
        }

        const nextStep = (stepIndex + 1) % 16;
        let delay = stepTime;
        if (stepIndex % 2 !== 0 && swing > 0) {
            delay = stepTime * (1 + swing);
        } else if (swing > 0) {
            delay = stepTime * (1 - swing);
        }
        sequencerTimeoutRef.current = setTimeout(() => playStep(nextStep), delay);
    };

    // Clear the timeout and start from the current step
    clearTimeout(sequencerTimeoutRef.current);
    playStep(currentStep);

    return () => clearTimeout(sequencerTimeoutRef.current);
  }, [isPlaying, bpm, swing, sequence, playSound, isAudioReady, currentStep]);

  // Handlers for UI interactions
  const handleSequencePadClick = (stepIndex) => {
    if (!isAudioReady) return;
    setSequence(prev => {
        const newSequence = [...prev];
        const newTrack = [...newSequence[selectedTrackIndex]];
        newTrack[stepIndex] = !newTrack[stepIndex];
        newSequence[selectedTrackIndex] = newTrack;
        return newSequence;
    });
  };

  const handleTrackSelection = (trackIndex) => {
      if (!isAudioReady) return;
      setSelectedTrackIndex(trackIndex);
      // When a track is selected, update the preset display to match its current state
      const currentPresetName = voiceParameters[trackIndex].name;
      const presetIndex = presets.findIndex(p => p.name === currentPresetName);
      setCurrentPresetIndex(presetIndex !== -1 ? presetIndex : 0);
  };

  const handleMuteClick = (e, trackIndex) => {
    e.stopPropagation();
    if (!isAudioReady) return;
    setIsMuted(prev => {
        const newMuted = [...prev];
        newMuted[trackIndex] = !newMuted[trackIndex];
        return newMuted;
    });
  };

  const handleSynthParamChange = (paramId, value) => {
    if (!isAudioReady) return;
    const voiceIndex = selectedTrackIndex;
    setVoiceParameters(prev => {
      const newParams = [...prev];
      const currentVoice = { ...newParams[voiceIndex] };

      // Set preset name to 'Custom' if any parameter is changed
      currentVoice.name = 'Custom';

      if (['oscillator', 'pitch', 'detune'].includes(paramId)) {
        if (selectedOscillator === 'osc1') {
          currentVoice[paramId] = value;
        } else {
          const paramId2 = `${paramId}2`;
          currentVoice[paramId2] = value;
        }
      } else {
        currentVoice[paramId] = value;
      }
      newParams[voiceIndex] = currentVoice;
      return newParams;
    });
  };

  const Knob = ({ label, min, max, value, onChange, disabled, unit = '' }) => {
    const knobRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startValue, setStartValue] = useState(0);
    const [startY, setStartY] = useState(0);

    const handleInteractionStart = useCallback((e) => {
        if (disabled) return;
        setIsDragging(true);
        e.preventDefault();
        const clientY = e.touches?.[0].clientY || e.clientY;
        setStartY(clientY);
        setStartValue(value);
    }, [value, disabled]);

    const handleInteractionMove = useCallback((e) => {
        if (!isDragging || disabled) return;
        e.preventDefault();
        const clientY = e.touches?.[0].clientY || e.clientY;
        const deltaY = clientY - startY;
        const sensitivity = (max - min) / 200;
        const newValue = startValue - deltaY * sensitivity;
        onChange(Math.max(min, Math.min(max, newValue)));
    }, [isDragging, min, max, startValue, startY, onChange, disabled]);

    const handleInteractionEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (!isDragging) return;
        window.addEventListener('mousemove', handleInteractionMove);
        window.addEventListener('mouseup', handleInteractionEnd);
        window.addEventListener('touchmove', handleInteractionMove, { passive: false });
        window.addEventListener('touchend', handleInteractionEnd);
        return () => {
            window.removeEventListener('mousemove', handleInteractionMove);
            window.removeEventListener('mouseup', handleInteractionEnd);
            window.removeEventListener('touchmove', handleInteractionMove);
            window.removeEventListener('touchend', handleInteractionEnd);
        };
    }, [isDragging, handleInteractionMove, handleInteractionEnd]);

    const rotation = ((value - min) / (max - min)) * 270 - 135; // Map value to -135deg to +135deg

    return (
      <div className="flex flex-col items-center">
        <div
          ref={knobRef}
          className={`relative w-10 h-10 touch-action-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          onMouseDown={handleInteractionStart}
          onTouchStart={handleInteractionStart}
        >
          <svg className="knob-svg w-full h-full" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="#1f2937"
              stroke="#374151"
              strokeWidth="4"
              className="drop-shadow-md"
            />
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="15"
              stroke="#22d3ee"
              strokeWidth="8"
              strokeLinecap="round"
              style={{ transformOrigin: '50% 50%', transform: `rotate(${rotation}deg)`, opacity: disabled ? 0.3 : 1 }}
            />
          </svg>
        </div>
        <span className="knob-label text-[10px] text-gray-400 mt-1">{label}</span>
      </div>
    );
  };

  const OscillatorSelect = ({ value, onChange, disabled }) => {
      const options = ['sine', 'triangle', 'square', 'sawtooth', 'noise'];
      return (
          <div className="flex flex-col items-center w-full">
              <select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={disabled}
                  className={`w-16 h-8 bg-gray-800 text-gray-200 rounded-lg appearance-none cursor-pointer px-2 text-center text-sm drop-shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                  {options.map(option => (
                      <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                  ))}
              </select>
              <span className="knob-label text-xs text-gray-400 mt-1">Wave</span>
          </div>
      );
  };

  const LfoTargetSwitch = ({ value, onChange, disabled }) => {
    return (
      <div className="flex flex-col items-center">
        <div
          onClick={() => !disabled && onChange(value === 'pitch' ? 'filter' : 'pitch')}
          className={`w-16 h-8 bg-gray-800 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className={`text-xs font-bold transition-all duration-200 px-2 rounded-full py-1 ${value === 'pitch' ? 'bg-cyan-500 text-white' : 'text-gray-400'}`}>P</span>
          <span className={`text-xs font-bold transition-all duration-200 px-2 rounded-full py-1 ${value === 'filter' ? 'bg-cyan-500 text-white' : 'text-gray-400'}`}>F</span>
        </div>
        <span className="knob-label text-[10px] text-gray-400 mt-1">LFO Target</span>
      </div>
    );
  };

  const OscSelectorSwitch = ({ value, onChange, disabled }) => {
      return (
        <div className="flex flex-col items-center">
          <div
            onClick={() => !disabled && onChange(value === 'osc1' ? 'osc2' : 'osc1')}
            className={`w-16 h-8 bg-gray-800 rounded-full flex items-center justify-center cursor-pointer transition-colors duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className={`text-xs font-bold transition-all duration-200 px-2 rounded-full py-1 ${value === 'osc1' ? 'bg-cyan-500 text-white' : 'text-gray-400'}`}>1</span>
            <span className={`text-xs font-bold transition-all duration-200 px-2 rounded-full py-1 ${value === 'osc2' ? 'bg-cyan-500 text-white' : 'text-gray-400'}`}>2</span>
          </div>
          <span className="knob-label text-[10px] text-gray-400 mt-1">Oscillator</span>
        </div>
      );
  };

  return (
    <div className="bg-gray-900 min-h-screen p-4 pb-16 text-gray-200 font-sans flex flex-col items-center overflow-auto">
      <div className="max-w-7xl w-full space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-black text-cyan-500 drop-shadow-lg">Wallabeat</h1>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-bold text-gray-400">BPM</label>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={!isAudioReady}
              className={`w-16 bg-gray-800 text-gray-200 text-center rounded-lg px-2 py-1 drop-shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400
              ${!isAudioReady ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <Knob label="Swing" min={0} max={0.5} value={swing} onChange={setSwing} disabled={!isAudioReady} />
            <Knob label="Volume" min={0} max={1} value={masterVolume} onChange={setMasterVolume} disabled={!isAudioReady} />
            <Knob label="Overdrive" min={0} max={1} value={masterOverdrive} onChange={setMasterOverdrive} disabled={!isAudioReady} />
            <Knob label="Comp." min={0} max={1} value={masterCompression} onChange={setMasterCompression} disabled={!isAudioReady} />
            <Knob label="Reverb" min={0.5} max={10} value={masterReverbDecay} onChange={setMasterReverbDecay} disabled={!isAudioReady} />
          </div>
          <div className="flex items-center space-x-2">
            {!isAudioReady && !isInitializing ? (
                <button
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-full transition duration-200 drop-shadow-lg"
                    onClick={initializeAudio}
                >
                    Start
                </button>
            ) : isInitializing ? (
                <button
                    className="bg-gray-500 text-white font-bold py-2 px-6 rounded-full transition duration-200 drop-shadow-lg cursor-not-allowed"
                    disabled
                >
                    Loading...
                </button>
            ) : (
                <>
                    <button
                        className={`bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-6 rounded-full transition duration-200 drop-shadow-lg
                        ${isPlaying ? 'bg-red-500 hover:bg-red-600' : ''}`}
                        onClick={() => setIsPlaying(prev => !prev)}
                        disabled={!isAudioReady}
                    >
                        {isPlaying ? 'Stop' : 'Play'}
                    </button>
                </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-3xl shadow-xl space-y-4 shadow-cyan-500/10 col-span-1 md:col-span-2 lg:col-span-3">
            <h3 className="text-center text-gray-400 font-bold mb-2">Track {selectedTrackIndex + 1} Parameters</h3>
            <div className="flex flex-wrap items-end justify-center gap-4">

              <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700/50">
                <div className="flex items-center justify-center space-x-2">
                  <button
                      onClick={() => handlePresetChange(-1)}
                      disabled={!isAudioReady}
                      className={`w-8 h-8 flex items-center justify-center text-white text-xl bg-gray-800 rounded-lg drop-shadow-md hover:bg-gray-700 active:scale-95 transition-all duration-100 ease-out
                      ${!isAudioReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                      <
                  </button>
                  <div className="w-36 h-8 bg-gray-900 text-green-400 font-mono text-sm flex items-center justify-center rounded-lg border border-gray-600 shadow-inner overflow-hidden">
                      <span className="truncate px-2">{voiceParameters[selectedTrackIndex].name}</span>
                  </div>
                  <button
                      onClick={() => handlePresetChange(1)}
                      disabled={!isAudioReady}
                      className={`w-8 h-8 flex items-center justify-center text-white text-xl bg-gray-800 rounded-lg drop-shadow-md hover:bg-gray-700 active:scale-95 transition-all duration-100 ease-out
                      ${!isAudioReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                      >
                  </button>
                  <button
                    onClick={handleAudition}
                    disabled={!isAudioReady}
                    className={`w-10 h-10 rounded-xl drop-shadow-md transition-all duration-100 ease-out font-bold flex items-center justify-center
                    ${isAudioReady ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50' : 'bg-gray-700 hover:bg-gray-600 active:scale-95'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-play-fill" viewBox="0 0 16 16">
                      <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                    </svg>
                  </button>
                </div>
                <span className="knob-label text-sm text-gray-400 mt-1">Preset</span>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700/50">
                <span className="text-sm font-bold text-gray-300 mb-2">Oscillator</span>
                <div className="flex gap-2">
                  <OscSelectorSwitch value={selectedOscillator} onChange={setSelectedOscillator} disabled={!isAudioReady} />
                  <OscillatorSelect
                      value={selectedOscillator === 'osc1' ? voiceParameters[selectedTrackIndex].oscillator : voiceParameters[selectedTrackIndex].oscillator2}
                      onChange={(value) => handleSynthParamChange('oscillator', value)}
                      disabled={!isAudioReady}
                  />
                  <Knob label={`Pitch ${selectedOscillator === 'osc1' ? '1' : '2'}`} min={-2400} max={2400} value={selectedOscillator === 'osc1' ? voiceParameters[selectedTrackIndex].pitch : voiceParameters[selectedTrackIndex].pitch2} onChange={(value) => handleSynthParamChange('pitch', value)} disabled={!isAudioReady} />
                  <Knob label={`Detune ${selectedOscillator === 'osc1' ? '1' : '2'}`} min={-100} max={100} value={selectedOscillator === 'osc1' ? voiceParameters[selectedTrackIndex].detune : voiceParameters[selectedTrackIndex].detune2} onChange={(value) => handleSynthParamChange('detune', value)} disabled={!isAudioReady} />
                  <Knob label="Blend" min={0} max={1} value={voiceParameters[selectedTrackIndex].blend} onChange={(value) => handleSynthParamChange('blend', value)} disabled={!isAudioReady} />
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700/50">
                <span className="text-sm font-bold text-gray-300 mb-2">Filter</span>
                <div className="flex gap-2">
                  <Knob label="LP Cut" min={100} max={20000} value={voiceParameters[selectedTrackIndex].lpFilter} onChange={(value) => handleSynthParamChange('lpFilter', value)} disabled={!isAudioReady} />
                  <Knob label="HP Cut" min={20} max={10000} value={voiceParameters[selectedTrackIndex].hpFilter} onChange={(value) => handleSynthParamChange('hpFilter', value)} disabled={!isAudioReady} />
                  <Knob label="Res" min={0} max={20} value={voiceParameters[selectedTrackIndex].filterRes} onChange={(value) => handleSynthParamChange('filterRes', value)} disabled={!isAudioReady} />
                  <Knob label="Env Amt" min={0} max={10000} value={voiceParameters[selectedTrackIndex].filterEnvAmount} onChange={(value) => handleSynthParamChange('filterEnvAmount', value)} disabled={!isAudioReady} />
                  <Knob label="Decay" min={0.01} max={5} value={voiceParameters[selectedTrackIndex].filterDecay} onChange={(value) => handleSynthParamChange('filterDecay', value)} disabled={!isAudioReady} />
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700/50">
                <span className="text-sm font-bold text-gray-300 mb-2">Per-Voice EQ</span>
                <div className="flex gap-2">
                  <Knob label="Low" min={-12} max={12} value={voiceParameters[selectedTrackIndex].lowGain} onChange={(value) => handleSynthParamChange('lowGain', value)} disabled={!isAudioReady} />
                  <Knob label="Mid" min={-12} max={12} value={voiceParameters[selectedTrackIndex].midGain} onChange={(value) => handleSynthParamChange('midGain', value)} disabled={!isAudioReady} />
                  <Knob label="High" min={-12} max={12} value={voiceParameters[selectedTrackIndex].highGain} onChange={(value) => handleSynthParamChange('highGain', value)} disabled={!isAudioReady} />
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700/50">
                <span className="text-sm font-bold text-gray-300 mb-2">VCA Env</span>
                <div className="flex gap-2">
                  <Knob label="A" min={0.001} max={1} value={voiceParameters[selectedTrackIndex].vcaAttack} onChange={(value) => handleSynthParamChange('vcaAttack', value)} disabled={!isAudioReady} />
                  <Knob label="D" min={0.01} max={2} value={voiceParameters[selectedTrackIndex].vcaDecay} onChange={(value) => handleSynthParamChange('vcaDecay', value)} disabled={!isAudioReady} />
                  <Knob label="S" min={0} max={1} value={voiceParameters[selectedTrackIndex].vcaSustain} onChange={(value) => handleSynthParamChange('vcaSustain', value)} disabled={!isAudioReady} />
                  <Knob label="R" min={0.01} max={2} value={voiceParameters[selectedTrackIndex].vcaRelease} onChange={(value) => handleSynthParamChange('vcaRelease', value)} disabled={!isAudioReady} />
                </div>
              </div>

              <div className="flex flex-col items-center p-2 rounded-lg bg-gray-700/50">
                <span className="text-sm font-bold text-gray-300 mb-2">Modulation</span>
                <div className="flex gap-2">
                  <Knob label="Pan" min={-1} max={1} value={voiceParameters[selectedTrackIndex].pan} onChange={(value) => handleSynthParamChange('pan', value)} disabled={!isAudioReady} />
                  <Knob label="LFO Rate" min={0.1} max={20} value={voiceParameters[selectedTrackIndex].lfoRate} onChange={(value) => handleSynthParamChange('lfoRate', value)} disabled={!isAudioReady} />
                  <Knob label="LFO Depth" min={0} max={1000} value={voiceParameters[selectedTrackIndex].lfoDepth} onChange={(value) => handleSynthParamChange('lfoDepth', value)} disabled={!isAudioReady} />
                  <LfoTargetSwitch
                      value={voiceParameters[selectedTrackIndex].lfoTarget}
                      onChange={(value) => handleSynthParamChange('lfoTarget', value)}
                      disabled={!isAudioReady}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-3xl shadow-xl flex flex-col shadow-cyan-500/10 col-span-1">
            <h3 className="text-center text-gray-400 font-bold mb-2">Tracks</h3>
            <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="relative">
                        <button
                            onClick={() => handleTrackSelection(i)}
                            disabled={!isAudioReady}
                            className={`w-full p-2 rounded-xl drop-shadow-md transition-all duration-100 ease-out font-bold text-sm text-white flex items-center justify-center
                            ${i === selectedTrackIndex ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50' : 'bg-gray-700 hover:bg-gray-600'}
                            ${!isAudioReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span>{i + 1}</span>
                        </button>
                        <button
                            onClick={(e) => handleMuteClick(e, i)}
                            disabled={!isAudioReady}
                            className={`absolute -top-1 right-1 p-1 rounded-full w-5 h-5 flex items-center justify-center text-white text-xs font-bold transition-all duration-100 ease-out drop-shadow-md
                            ${isMuted[i] ? 'bg-yellow-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            M
                        </button>
                    </div>
                ))}
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-3xl shadow-xl flex flex-col shadow-cyan-500/10">
          <h3 className="text-center text-gray-400 font-bold mb-2">Sequencer</h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {Array.from({ length: 16 }).map((_, i) => (
                  <button
                      key={i}
                      className={`relative p-2 aspect-square rounded-xl drop-shadow-md transition-all duration-100 ease-out
                          ${sequence[selectedTrackIndex][i] ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50' : 'bg-gray-700 hover:bg-gray-600 active:scale-95'}
                          ${isPlaying && currentStep === i ? 'ring-4 ring-cyan-200 animate-pulse' : ''}
                          ${!isAudioReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => handleSequencePadClick(i)}
                      disabled={!isAudioReady}
                  >
                      <span className="absolute bottom-1 right-2 text-xs font-bold text-gray-300 opacity-70">{i + 1}</span>
                  </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;


