import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay,
  faPause,
  faSyncAlt,
  faCut,
} from '@fortawesome/free-solid-svg-icons';
import icon from '../../assets/icon.png';
import './App.css';
import NotificationOverlay from './NotificationOverlay';
import LoadingIndicator from './LoadingIndicator';

// Import the GuideNumber component
import GuideNumber from './GuideNumber';

interface RecordingData {
  toggle?: number;
  garyToggle?: number;  // New field for taming Gary
  action?: string;
  data?: string | number | { type: string; message: string };  // Add object type
  variation?: string;  // Add this for explicit typing
}

function Timeline() {
  const ticks = Array.from({ length: 31 }, (_, i) => i);

  return (
    <div className="timeline">
      {ticks.map((tick) => (
        <div key={tick} className="timeline-tick">
          {tick % 5 === 0 ? (
            <span className="timeline-label">{tick}</span>
          ) : (
            <span className="timeline-mark" />
          )}
        </div>
      ))}
    </div>
  );
}

function Hello() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); // State to track if audio is playing
  const [hasFinished, setHasFinished] = useState(false); // State to track if audio has finished playing
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const waveSurferOutRef = useRef<WaveSurfer | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const waveformOutRef = useRef<HTMLDivElement | null>(null);
  const [modelPath, setModelPath] = useState('');
  const [progress, setProgress] = useState(0);
  const [promptDuration, setPromptDuration] = useState(6);
  const [filePath, setFilePath] = useState('');
  const [isGaryTamed, setIsGaryTamed] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState('accordion_folk');

  // Debounce to avoid repeated triggers
  const isLoadingRef = useRef(false);

  // State to control the visibility of the guide
  const [guideVisible, setGuideVisible] = useState(false);
  const [maxConnection, setMaxConnection] = useState(false);
  const [backendConnection, setBackendConnection] = useState(false);
  const [errorMessage, setErrorMessage] = useState<{ type: string; message: string } | null>(null);

  const [lastValidPosition, setLastValidPosition] = useState(0);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    window.api.receive('toggle-guide', (isGuideVisible: boolean) => {
      setGuideVisible(isGuideVisible);
      console.log('Received toggle-guide:', isGuideVisible);
    });
  }, []);

  useEffect(() => {
    if (waveformRef.current) {
      waveSurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'red',
        progressColor: 'maroon',
        backend: 'WebAudio',
        interact: true,
        height: 50,
        duration: 30,
      });
    }
    if (waveformOutRef.current) {
      waveSurferOutRef.current = WaveSurfer.create({
        container: waveformOutRef.current,
        waveColor: 'red',
        progressColor: 'maroon',
        backend: 'WebAudio',
        interact: true,
        height: 50,
      });

      waveSurferOutRef.current.setMuted(true); // Mute the audio to prevent playback

      // Listen to the 'finish' event to update the playing state when the audio ends
      waveSurferOutRef.current.on('finish', () => {
        setIsPlaying(false);
        setHasFinished(true);
        // Reset cursor to beginning
        waveSurferOutRef.current?.seekTo(0);
        // Send reset and pause commands to Max
        sendToNodeScript({ action: 'reset' });
        sendToNodeScript({ action: 'pause' });
      });
    }

    window.electron.ipcRenderer.onAudioFileSaved((savedFilePath: string) => {
      setFilePath(savedFilePath);
      console.log('savedFilePath:', savedFilePath);
    });

    return () => {
      waveSurferRef.current?.destroy();
      waveSurferOutRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    const handleData = (data: Uint8Array) => {
      if (isLoadingRef.current) return; // Prevent re-entry

      const jsonStr = new TextDecoder().decode(data);
      try {
        const parsedData: RecordingData = JSON.parse(jsonStr);

        // Clear loading state when progress starts or we get errors
        if ((typeof parsedData.toggle === 'number' && parsedData.toggle > 0) || 
          parsedData.action === 'error_message') {
          setLoadingAction(null);
        }

        // Clear loading state when we receive new audio data
        if (parsedData.action === 'audio_data_output') {
          setLoadingAction(null);
        }

        // Add this case for error messages
        if (parsedData.action === 'error_message' && typeof parsedData.data === 'object') {
          console.log('Received error message:', parsedData.data); // Debug log
          setErrorMessage(parsedData.data as { type: string; message: string });
          return;
        }

        // Add this case to handle connection status
        if (parsedData.action === 'connection_status') {
          setMaxConnection(!!parsedData.data);
          setErrorMessage(null);  // Clear error message on new connection
          return;
        }
        // Handle Backend connection
        if (parsedData.action === 'backend_connection_status') {
          setBackendConnection(!!parsedData.data);
          setErrorMessage(null);  // Clear error message on new connection
          return;
        }

        // Add variation handling without expecting audio data
        if (parsedData.action === 'update_variation' && typeof parsedData.data === 'string') {
          setSelectedVariation(parsedData.data);
          return; // Early return for variation updates - no audio data needed
        }

        if (parsedData.garyToggle !== undefined) {
          setIsGaryTamed(parsedData.garyToggle === 1);
        }

        if (typeof parsedData.toggle === 'number') {
          if (parsedData.toggle === 0 || parsedData.toggle === 1) {
            setIsRecording(parsedData.toggle === 1);
          } else {
            setProgress(parsedData.toggle);
          }
        }

        if (parsedData.action && parsedData.data) {
          if (typeof parsedData.data === 'string') {
            const dataURI = `data:audio/wav;base64,${parsedData.data}`;
            const ref = parsedData.action === 'audio_data_output' ? waveSurferOutRef : waveSurferRef;
        
            // Prevent re-entrant load and save cycle
            isLoadingRef.current = true;
            console.log('Loading data into WaveSurfer...');
            
            // Add a one-time ready event listener before loading
            if (ref.current) {
                const handleReady = () => {
                    console.log('WaveSurfer ready, performing final reset');
                    // Ensure cursor is at 0 and playback state is correct
                    ref.current?.seekTo(0);
                    setLastValidPosition(0);
                    if (!isPlaying) {
                        ref.current?.pause();
                    }
                    // Remove the one-time listener
                    ref.current?.un('ready', handleReady);
                };
                ref.current.once('ready', handleReady);
            }
        
            ref.current?.load(dataURI);

            // Only save if it's the correct action to avoid redundant saves
            if (
              parsedData.action === 'audio_data_output' ||
              parsedData.action === 'save_buffer'
            ) {
              console.log('Saving file...');
              window.electron.ipcRenderer.saveAudioFile(parsedData.data);
            }

            setTimeout(() => {
              isLoadingRef.current = false;
            }, 500); // Small timeout to debounce
          } else if (
            parsedData.action === 'update_waveform_duration' &&
            typeof parsedData.data === 'number'
          ) {
            waveSurferOutRef.current?.load(filePath); // Reload with the cropped file
          } else {
            console.error(
              'Expected data to be a string or number but got:',
              typeof parsedData.data,
            );
          }
        }
      } catch (error) {
        console.error('Error parsing data:', error);
        setLoadingAction(null);  // Clear loading state on error
      }
    };

    window.api.receive('fromNodeScript', handleData);

    return () => {
      window.api.remove('fromNodeScript', handleData);
    };
  }, [filePath]);

  const sendToNodeScript = (payload: { action: string; data?: any }) => {
    const loadingActions = ['bang', 'continue', 'retry', 'load_output', 'crop', 'transform'];
    
    if (loadingActions.includes(payload.action)) {
        setLoadingAction(payload.action);
    }
    
    if (payload.action === 'load_output') {
      // Reset all playback-related states
      setLastValidPosition(0);
      waveSurferOutRef.current?.seekTo(0);
      
      // Double-check the cursor position after a brief delay
      setTimeout(() => {
        if (waveSurferOutRef.current?.getCurrentTime() !== 0) {
          waveSurferOutRef.current?.seekTo(0);
        }
      }, 10);
  
      // Reset playback state
      setIsPlaying(false);
      setHasFinished(false);
    }
    
    // Send the action to Max
    window.api.send('send-to-node-script', payload);
  };

  const handleModelPathChange = (event: any) => {
    const newPath = event.target.value;
    setModelPath(newPath);
    sendToNodeScript({ action: 'update_model_path', data: newPath });
  };

  const handlePromptDurationChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newDuration = parseInt(event.target.value, 10);
    setPromptDuration(newDuration);
    sendToNodeScript({ action: 'update_prompt_duration', data: newDuration });
  };

  const handleCropAudio = () => {
    if (waveSurferOutRef.current) {
      const end = waveSurferOutRef.current.getCurrentTime();
      sendToNodeScript({ action: 'crop', data: end });
  
      // Wait briefly for crop to complete, then trigger load_output to reset state
      setTimeout(() => {
        sendToNodeScript({ action: 'load_output' });
  
        // AFTER we trigger the load_output call, forcibly clear the loading
        setLoadingAction(null);
      }, 300);
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (filePath) {
      event.preventDefault(); // Prevent default behavior
      window.electron.ipcRenderer.startDrag(filePath);
      event.dataTransfer.setData('DownloadURL', `audio/wav:${filePath}`);
      console.log(`drag started for ${filePath}`);
    } else {
      console.error('filePath is undefined.');
    }
  };

  const handleReset = () => {
    // Force cursor to beginning and reset lastValidPosition
    setLastValidPosition(0);
    waveSurferOutRef.current?.seekTo(0);
    
    // Double-check the cursor position after a brief delay
    setTimeout(() => {
      if (waveSurferOutRef.current?.getCurrentTime() !== 0) {
        waveSurferOutRef.current?.seekTo(0);
      }
    }, 10);
  
    if (isPlaying) {
      waveSurferOutRef.current?.setPlaybackRate(1);
      waveSurferOutRef.current?.play();
    } else {
      waveSurferOutRef.current?.pause();
    }
  
    setHasFinished(false);
    sendToNodeScript({ action: 'reset' });
  };

  const handlePlay = () => {
    if (hasFinished) {
      // If audio finished, start from beginning
      setHasFinished(false);
      waveSurferOutRef.current?.seekTo(0);
      // Ensure reset happens before play
      sendToNodeScript({ action: 'reset' });
      setTimeout(() => {
        setIsPlaying(true);
        waveSurferOutRef.current?.play();
        sendToNodeScript({ action: 'play' });
      }, 50);
    } else {
      // If cursor was moved while paused, restore to last valid position
      const currentPos = waveSurferOutRef.current?.getCurrentTime() || 0;
      if (Math.abs(currentPos - lastValidPosition) > 0.1) { // Small threshold for floating point comparison
        waveSurferOutRef.current?.seekTo(lastValidPosition / (waveSurferOutRef.current?.getDuration() || 1));
      }
      
      setIsPlaying(true);
      waveSurferOutRef.current?.play();
      sendToNodeScript({ action: 'play' });
    }
  };

  const handlePause = () => {
    // Store current position when pausing
    if (waveSurferOutRef.current) {
      setLastValidPosition(waveSurferOutRef.current.getCurrentTime());
    }
    setIsPlaying(false);
    waveSurferOutRef.current?.pause();
    sendToNodeScript({ action: 'pause' });
  };

  return (
    <div>
      <NotificationOverlay
        maxConnection={maxConnection}
        backendConnection={backendConnection}
        errorMessage={errorMessage}
      />
      
      <LoadingIndicator action={loadingAction} />

      {/* Backend Status Blurb */}
      <div className="backend-status">
        check whether gary's backend is live{' '}
        <a
          href="https://thecollabagepatch.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          here
        </a>
        . click 'about that gary tho' at the top.
      </div>

      <div className={`logo ${progress > 0 && progress < 100 ? 'spin' : ''}`}>
        <img width="150" alt="icon" src={icon} />
      </div>

      {/* Top row container */}
<div className="top-row">
  {/* Left side group */}
  <div className="left-controls">
    {/* Recording Indicator with Guide Number (Step 1) */}
    <div className="indicator-wrapper">
      <div className="indicator">
        {isRecording ? (
          <div className="recording-indicator" />
        ) : (
          <div className="idle-indicator" />
        )}
      </div>
      {guideVisible && (
        <GuideNumber
          number={1}
          blurb="red = recording. press play in ableton to begin recording into the 30-second buffer. press fix_toggle if the recording indicator is not synced with ableton's playback state."
        />
      )}
    </div>

    {/* fix_toggle Button */}
    <div className="control-wrapper">
      <button
        type="button"
        onClick={() => sendToNodeScript({ action: 'fix_toggle' })}
      >
        fix_toggle
      </button>
    </div>

    {/* Gary toggle */}
    <div className="gary-toggle-wrapper">
      <button
        type="button"
        onClick={() => {
          setIsGaryTamed(!isGaryTamed);
          sendToNodeScript({
            action: 'update_gary_state',
            data: { garyToggle: isGaryTamed ? 0 : 1 }
          });
        }}
        className={`gary-toggle ${isGaryTamed ? 'active' : ''}`}
      >
        {isGaryTamed ? 'gary tamed' : 'tame gary'}
      </button>
      {guideVisible && (
        <GuideNumber
          number={12}
          blurb="toggle this to make gary more likely to become 'lil percussion guy'."
        />
      )}
    </div>
  </div>

   {/* Transform buttons on right */}
<div className="transform-controls">
<button
    type="button"
    onClick={() => sendToNodeScript({ action: 'transform' })}
    className="transform-button"
>
    transform
    {guideVisible && (
        <GuideNumber
            number={13}
            blurb="transform either the recorded buffer or 35 seconds of what gary made. If the output is longer than 35 seconds, it will return transformed audio only up until that point. drag the gary into ableton so you don't lose the later part of the output. you can have gary continue what you transformed"
            isTransformButton={true}
        />
    )}
</button>

  <button
    type="button"
    onClick={() => {
      sendToNodeScript({ action: 'undo_transform' });
      
      // Wait briefly for undo to complete, then trigger load_output to reset state
      setTimeout(() => {
        sendToNodeScript({ action: 'load_output' });
      }, 500);
    }}
    className="undo-transform-button"
  >
    undo
    {guideVisible && (
      <GuideNumber
        number={14}
        blurb="revert the audio back to what it was before you transformed it. it will replace the bottom waveform"
      />
    )}
  </button>

  <button
    type="button"
    onClick={() => {
      sendToNodeScript({
        action: 'reset_transform',
        data: {
          modelPath,
          promptDuration,
          variation: selectedVariation
        }
      });
    }}
    className="reset-transform-button"
  >
    reset
    {guideVisible && (
      <GuideNumber
        number={15}
        blurb="press reset to restart the session so you can go back to transforming the recorded audio in the top waveform rather than the bottom waveform. it also restarts your session with gary so be careful"
      />
    )}
  </button>
</div>
</div>

{/* Progress and variation select row */}
<div className="progress-row">
  <div>progress: {progress}%</div>
  <select
    value={selectedVariation}
    onChange={(e) => {
      setSelectedVariation(e.target.value);
      sendToNodeScript({
        action: 'update_variation',
        data: e.target.value
      });
    }}
    className="variation-select"
  >
    <option value="accordion_folk">accordion_folk</option>
      <option value="banjo_bluegrass">banjo_bluegrass</option>
      <option value="piano_classical">piano_classical</option>
      <option value="celtic">celtic</option>
      <option value="strings_quartet">strings_quartet</option>
      <option value="synth_retro">synth_retro</option>
      <option value="synth_modern">synth_modern</option>
      <option value="synth_edm">synth_edm</option>
      <option value="lofi_chill">lofi_chill</option>
      <option value="synth_bass">synth_bass</option>
      <option value="rock_band">rock_band</option>
      <option value="cinematic_epic">cinematic_epic</option>
      <option value="retro_rpg">retro_rpg</option>
      <option value="chiptune">chiptune</option>
      <option value="steel_drums">steel_drums</option>
      <option value="gamelan_fusion">gamelan_fusion</option>
  </select>
</div>

      {/* Waveform Display */}
      <div ref={waveformRef} className="waveform" />
      <Timeline />
      <div ref={waveformOutRef} className="waveform-out" />

      {/* Drag Me with Guide Number (Step 11) */}
      <div
        className="control-wrapper"
        draggable="true"
        onDragStart={handleDragStart}
      >
        <div className="draggable-area">drag me</div>
        {guideVisible && (
          <GuideNumber
            number={11}
            blurb="when you're happy with the output, drag it into the ableton timeline. (hint: if ableton auto-warps the waveform when you drag it in, you can double-click it and press the 'warp' button twice to have it line up with your input.)"
          />
        )}
      </div>

      <div className="Hello">
        {/* Model Path Input with Guide Number (Step 3) */}
        <div className="control-wrapper">
          <input
            type="text"
            value={modelPath}
            onChange={handleModelPathChange}
            placeholder="enter model path"
            className="model-path-input"
          />
          {guideVisible && (
            <GuideNumber
              number={3}
              blurb={`type in the fine-tune you want to use. default is 'thepatch/vanya_ai_dnb_0.1'\n\nother models to try:\n- thepatch/bleeps-medium\n- facebook/musicgen-small\n- facebook/musicgen-medium\n- thepatch/hoenn_lofi (large model, slow)\n\nany audiocraft fine-tune on huggingface can be typed in here.`}
            />
          )}
        </div>

        {/* Prompt Duration Input with Guide Number (Step 4) */}
        <div className="control-wrapper">
          <input
            type="number"
            value={promptDuration}
            min="1"
            max="15"
            onChange={handlePromptDurationChange}
            placeholder="set prompt duration"
            className="prompt-duration-input"
          />
          {guideVisible && (
            <GuideNumber
              number={4}
              blurb="choose the number of seconds you want it to start its continuation from. this number can change outputs wildly. defaults to 6 seconds. 'bang' uses the beginning of the input. 'continue' and 'retry' go from the end."
            />
          )}
        </div>

        {/* Play Button with Guide Number (Step 7) */}
        <div className="control-wrapper">
          <button type="button" onClick={handlePlay}>
            <FontAwesomeIcon icon={faPlay} />
          </button>
          {/* {guideVisible && (
            <GuideNumber
              number={7}
              blurb="press these to listen to what gary just made. duh."
            />
          )} */}
        </div>

        {/* Pause Button with Guide Number (Step 7 continued) */}
        <div className="control-wrapper">
          <button type="button" onClick={handlePause}>
            <FontAwesomeIcon icon={faPause} />
          </button>
          {guideVisible && (
            <GuideNumber
              number={7}
              blurb="press these to listen to the output."
            />
          )}
        </div>

        {/* Reset Button */}
        <div className="control-wrapper">
          <button type="button" onClick={handleReset}>
            <FontAwesomeIcon icon={faSyncAlt} />
          </button>
          {/* {guideVisible && (
            <GuideNumber
              number={7}
              blurb="Press these to listen to what Gary just made."
            />
          )} */}
        </div>

        <div className="control-wrapper">
  <button
    type="button"
    onClick={() => {
      if (!backendConnection) {
        setErrorMessage({
          type: 'connection',
          message: "can't generate audio without backend connection. check your wifi and press '3' in m4l."
        });
        return;
      }
      sendToNodeScript({ action: 'bang' });
    }}
  >
    bang
  </button>
  {guideVisible && (
    <GuideNumber
      number={5}
      blurb="when you're ready, press this to get the initial generation. always returns 30 seconds of audio."
    />
  )}
</div>

<div className="control-wrapper">
  <button
    type="button"
    onClick={() => {
      if (!backendConnection) {
        setErrorMessage({
          type: 'connection',
          message: "can't generate audio without backend connection. check your wifi and press '3' in m4l."
        });
        return;
      }
      sendToNodeScript({ action: 'continue' });
    }}
  >
    continue
  </button>
  {guideVisible && (
    <GuideNumber
      number={9}
      blurb="when you want it to pick up where the output left off (or from where you cropped it), press this. always returns 30 seconds of audio. you can change the model and prompt duration. here, the prompt is taken from the end of the waveform. you can press this a couple of times before the packet is too large."
    />
  )}
</div>

<div className="control-wrapper">
  <button
    type="button"
    onClick={() => {
      if (!backendConnection) {
        setErrorMessage({
          type: 'connection',
          message: "can't generate audio without backend connection. check your wifi and press '3' in m4l."
        });
        return;
      }
      sendToNodeScript({ action: 'retry' });
    }}
  >
    retry
  </button>
  {guideVisible && (
    <GuideNumber
      number={10}
      blurb="when you want try and make an output from the exact same place it just continued from (with a different model or number of seconds if you want), press this."
    />
  )}
</div>

        {/* Save Buffer Button with Guide Number (Step 2) */}
        <div className="control-wrapper">
          <button
            type="button"
            onClick={() => sendToNodeScript({ action: 'write_buffer' })}
          >
            save buffer
          </button>
          {guideVisible && (
            <GuideNumber
              number={2}
              blurb="press this to save the buffer you just recorded. it will display as the waveform on the top."
              isBottomButton={true}
            />
          )}
        </div>

        {/* Load Output Button with Guide Number (Step 6) */}
        <div className="control-wrapper">
          <button
            type="button"
            onClick={() => sendToNodeScript({ action: 'load_output' })}
          >
            load output
          </button>
          {guideVisible && (
            <GuideNumber
              number={6}
              blurb="when progress reaches 100%, press this to load the output gary just made into the bottom waveform."
            />
          )}
        </div>

        {/* Crop Button with Guide Number (Step 8) */}
        <div className="control-wrapper">
          <button type="button" onClick={handleCropAudio}>
            <FontAwesomeIcon icon={faCut} />
          </button>
          {guideVisible && (
            <GuideNumber
              number={8}
              blurb="crop off the end of the output by clicking anywhere on the bottom waveform first to move the cursor. sometimes gary does an abrupt stop before he's finished, or maybe he rambled on too much."
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
