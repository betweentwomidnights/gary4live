/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import * as fs from 'fs';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import WebSocket, { WebSocketServer } from 'ws';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
const wss = new WebSocketServer({ port: 8080 });
let connectedClient: WebSocket | null = null;

wss.on('connection', function connection(ws) {
  console.log('WebSocket server: Client connected');
  connectedClient = ws; // Store the connected client for later use

  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    if (mainWindow) {
      mainWindow.webContents.send('fromNodeScript', message);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket server: Client disconnected');
    connectedClient = null;
  });
});

function sendMessageToNodeScript(data: { action: string; data?: any }) {
  if (connectedClient && connectedClient.readyState === WebSocket.OPEN) {
    connectedClient.send(JSON.stringify(data)); // Send data as stringified JSON
  }
}

ipcMain.on('send-to-node-script', (_, payload) => {
  sendMessageToNodeScript(payload); // Ensure that `payload` is treated as an object within `sendMessageToNodeScript`
});

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// Function to ensure directory exists
const ensureDirectoryExists = (filePath: string) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Function to convert base64 to a file
const saveBase64AudioToFile = (base64Data: string, filePath: string) => {
  const buffer = Buffer.from(base64Data, 'base64');
  ensureDirectoryExists(filePath); // Ensure directory exists
  try {
    fs.writeFileSync(filePath, buffer);
    console.log(`File saved to ${filePath}`);
  } catch (err) {
    console.error('Error saving file:', err);
  }
};

// Generate a unique filename using a timestamp
const generateUniqueFilename = (basePath: string, extension: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Format timestamp
  return path.join(basePath, `audio_${timestamp}.${extension}`);
};

// Listen for the 'save-audio-file' IPC message
ipcMain.on('save-audio-file', (event, base64Data) => {
  const projectPath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../');
  const filePath = generateUniqueFilename(path.join(projectPath, 'saved-audio'), 'wav'); // Generate unique filename
  console.log(`Saving file to ${filePath}`);
  saveBase64AudioToFile(base64Data, filePath);
  event.sender.send('audio-file-saved', filePath);
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 660,
    height: 515,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true, // Enable Node.js integration
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
    alwaysOnTop: true,
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.on('ondragstart', (event, filePath) => {
    console.log(`Dragging file from ${filePath}`);
    const iconPath = getAssetPath('icon.ico');
    console.log(`Using icon at ${iconPath}`);

    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist at ${filePath}`);
      return;
    }

    if (!fs.existsSync(iconPath)) {
      console.error(`Icon does not exist at ${iconPath}`);
      return;
    }

    try {
      event.sender.startDrag({
        file: filePath,
        icon: iconPath,
      });
      console.log('Drag operation started successfully.');
    } catch (error) {
      console.error('Error starting drag operation:', error);
    }
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
  // eslint-disable-next-line no-new
  new AppUpdater();
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
