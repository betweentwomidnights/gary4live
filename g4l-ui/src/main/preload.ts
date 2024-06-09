// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'save-audio-file'
  | 'audio-file-saved'
  | 'ondragstart';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    saveAudioFile: (base64Data: string) => {
      console.log('Preload sending save-audio-file with data:', base64Data);
      ipcRenderer.send('save-audio-file', base64Data);
    },
    onAudioFileSaved: (callback: (filePath: string) => void) => {
      console.log('Preload setting listener for audio-file-saved');
      ipcRenderer.on('audio-file-saved', (_event, filePath) =>
        callback(filePath),
      );
    },
    startDrag: (fileName: string) => {
      ipcRenderer.send('ondragstart', fileName);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

const api = {
  send: (channel: Channels, data: any) => {
    console.log(`Preload sending ${channel} with data:`, data);
    ipcRenderer.send(channel, data);
  },
  receive: (channel: Channels, func: (data: any) => void) => {
    console.log(`Preload receiving on channel: ${channel}`);
    ipcRenderer.on(channel, (_, data) => {
      console.log(`Data received on channel ${channel}:`, data);
      func(data);
    });
  },
  remove: (channel: Channels, func: (...args: any[]) => void) => {
    console.log(`Preload removing listener on channel: ${channel}`);
    ipcRenderer.removeListener(channel, func);
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);
contextBridge.exposeInMainWorld('api', api);

export type ElectronHandler = typeof electronHandler;
export type Api = typeof api;
