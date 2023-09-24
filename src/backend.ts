import type * as Electron from 'electron';
import { ipcMain as defaultIpcMain } from 'electron';

interface IpcMessages {
  backend: Record<string, any>;
  frontend: Record<string, any>;
}

type ElectronEventListener = (event: Electron.IpcMainEvent, value: any) => any;
type EventListener<T = any> = (value: T, event: Electron.IpcMainEvent) => any;
type Unsubscribe = () => void;

interface IpcMain {
  on(channel: string, listener: ElectronEventListener): void;
  off(channel: string, listener: ElectronEventListener): void;
}

interface BrowserWindow {
  webContents: {
    send(channel: string, value: any): void;
  };
}

export class BackendIpc<T extends IpcMessages> {
  private electronListeners: Partial<Record<keyof T['frontend'], ElectronEventListener>> = {};
  private listeners: Partial<Record<keyof T['frontend'], EventListener[]>> = {};
  private browserWindows: BrowserWindow[] = [];
  private singleBrowserWindow: BrowserWindow | null = null;
  private outstandingMessages: [string, any][] = [];

  constructor(private ipcMain: IpcMain = defaultIpcMain) {}

  public provideBrowserWindow(window: BrowserWindow) {
    if (this.singleBrowserWindow) {
      throw new Error(`Cannot mix single window mode with multiple`);
    }
    this.browserWindows.push(window);
    for (const [channel, message] of this.outstandingMessages) {
      window.webContents.send(channel, message);
    }
    this.outstandingMessages = [];
  }

  public provideSingleBrowserWindow(window: BrowserWindow) {
    if (this.browserWindows.length > 0) {
      throw new Error(`Cannot mix single window mode with multiple`);
    }
    this.singleBrowserWindow = window;
    for (const [channel, message] of this.outstandingMessages) {
      window.webContents.send(channel, message);
    }
    this.outstandingMessages = [];
  }

  public on<C extends keyof T['frontend']>(channel: C, listener: EventListener<T['frontend'][C]>): Unsubscribe {
    if (!this.listeners[channel] || !Array.isArray(this.listeners[channel])) {
      this.listeners[channel] = [];
    }
    const listeners = this.listeners[channel] as EventListener[];
    if (listeners.length === 0) {
      const electronEventListener: ElectronEventListener = (event, value) => {
        if (this.singleBrowserWindow && event.sender !== this.singleBrowserWindow.webContents) return;
        listeners.forEach((listener) => listener(value, event));
      };
      this.electronListeners[channel] = electronEventListener;
      this.ipcMain.on(channel as string, electronEventListener);
    }
    listeners.push(listener);
    return this.off.bind(this, channel, listener);
  }
  public off(channel: keyof T['frontend'], listener: EventListener<any>): void {
    const listeners = this.listeners[channel];
    if (Array.isArray(listeners)) {
      const indexOfListener = listeners.indexOf(listener);
      if (indexOfListener < 0) return;
      listeners.splice(indexOfListener, 1);
      if (listeners.length === 0) {
        const electronListener = this.electronListeners[channel];
        if (electronListener) {
          this.ipcMain.off(channel as string, electronListener);
          this.electronListeners[channel] = undefined;
        }
      }
    }
  }
  public send<C extends keyof T['backend']>(channel: C, message: T['backend'][C], browserWindow?: BrowserWindow): void {
    const window = browserWindow || this.singleBrowserWindow;
    if (window) {
      window.webContents.send(channel as string, message);
    } else if (this.browserWindows.length > 0) {
      for (const win of this.browserWindows) {
        win.webContents.send(channel as string, message);
      }
    } else {
      this.outstandingMessages.push([channel as string, message]);
    }
  }
}
