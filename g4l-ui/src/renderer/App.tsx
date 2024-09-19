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

// Import the GuideNumber component
import GuideNumber from './GuideNumber';

interface RecordingData {
  toggle?: number;
  action?: string;
  data?: string | number;
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

  // Debounce to avoid repeated triggers
  const isLoadingRef = useRef(false);

  // State to control the visibility of the guide
  const [guideVisible, setGuideVisible] = useState(false);

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
        setHasFinished(true); // Mark that the audio has finished
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
            const ref =
              parsedData.action === 'audio_data_output'
                ? waveSurferOutRef
                : waveSurferRef;

            // Prevent re-entrant load and save cycle
            isLoadingRef.current = true;
            console.log('Loading data into WaveSurfer...');
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
      }
    };

    window.api.receive('fromNodeScript', handleData);

    return () => {
      window.api.remove('fromNodeScript', handleData);
    };
  }, [filePath]);

  const sendToNodeScript = (payload: { action: string; data?: any }) => {
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
    waveSurferOutRef.current?.seekTo(0); // Move cursor to the beginning of myOutput.wav
    if (isPlaying) {
      waveSurferOutRef.current?.setPlaybackRate(1); // Ensure the cursor moves at the normal rate
      waveSurferOutRef.current?.play(); // Start cursor movement with no audio
    } else {
      waveSurferOutRef.current?.pause(); // Pause the cursor if not playing
    }
    setHasFinished(false); // Reset the finished state
    sendToNodeScript({ action: 'reset' }); // Trigger the reset action in Max for Live
  };

  const handlePlay = () => {
    if (hasFinished) {
      // If the audio has finished, send 'reset' before 'play'
      sendToNodeScript({ action: 'reset' });
      waveSurferOutRef.current?.seekTo(0); // Reset the cursor to the beginning
    }
    setIsPlaying(true); // Set playing state to true
    waveSurferOutRef.current?.setPlaybackRate(1); // Ensure the cursor moves at the normal rate
    waveSurferOutRef.current?.play(); // Resume cursor movement with no audio
    sendToNodeScript({ action: 'play' }); // Trigger the play action in Max for Live
    setHasFinished(false); // Ensure hasFinished is reset
  };

  const handlePause = () => {
    setIsPlaying(false); // Set playing state to false
    waveSurferOutRef.current?.pause(); // Pause cursor movement for myOutput.wav
    sendToNodeScript({ action: 'pause' }); // Trigger the pause action in Max for Live
  };

  return (
    <div>

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

      {/* fix_toggle Button with Guide Number (Step 1 continued) */}
      <div className="control-wrapper">
        <button
          type="button"
          onClick={() => sendToNodeScript({ action: 'fix_toggle' })}
        >
          fix_toggle
        </button>
        {/* {guideVisible && (
          <GuideNumber
            number={1}
            blurb="Red = recording. Press play in Ableton to begin recording into the 30-second buffer. Press fix_toggle if the recording indicator is not synced with Ableton's playback state."
          />
        )} */}
      </div>

      <div>progress: {progress}%</div>

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

        {/* Bang Button with Guide Number (Step 5) */}
        <div className="control-wrapper">
          <button
            type="button"
            onClick={() => sendToNodeScript({ action: 'bang' })}
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

        {/* Continue Button with Guide Number (Step 9) */}
        <div className="control-wrapper">
          <button
            type="button"
            onClick={() => sendToNodeScript({ action: 'continue' })}
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

        {/* Retry Button with Guide Number (Step 10) */}
        <div className="control-wrapper">
          <button
            type="button"
            onClick={() => sendToNodeScript({ action: 'retry' })}
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
