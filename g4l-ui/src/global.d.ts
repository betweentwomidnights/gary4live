export { };

declare global {
  interface Window {
    api: {
      send: (channel: string, data: any) => void;
      receive: (channel: string, func: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
      remove: (channel: string, func: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => void;
      startDrag: (filePath: string) => void;
      saveAudioFile: (base64Data: string) => void;
      onAudioFileSaved: (callback: (filePath: string) => void) => void;
    };
    electron: {
      ipcRenderer: {
        sendMessage(channel: string, ...args: unknown[]): void;
        saveAudioFile: (base64Data: string) => void;
        onAudioFileSaved: (callback: (filePath: string) => void) => void;
        on(channel: string, func: (...args: unknown[]) => void): () => void;
        once(channel: string, func: (...args: unknown[]) => void): void;
        startDrag: (filePath: string) => void;
      };
    };
  }
}
