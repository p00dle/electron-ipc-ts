import type { IpcRendererEvent } from 'electron';

type EventListener<T = any> = (value: T, event: IpcRendererEvent) => void;

type UntypedListener = (...args: any[]) => void;

export interface IpcMessages {
  backend: Record<string, any>;
  frontend: Record<string, any>;
}

class IpcStub {
  private listeners: Record<string, UntypedListener[]> = {};
  private sendListeners: Record<string, UntypedListener[]> = {};

  public on(channel: any, listener: UntypedListener) {
    if (!this.listeners[channel]) {
      this.listeners[channel] = [];
    }
    this.listeners[channel].push(listener);
  }
  public off(channel: any, listener: UntypedListener) {
    if (this.listeners[channel]) {
      const index = this.listeners[channel].indexOf(listener);
      if (index >= 0) {
        this.listeners[channel].splice(index, 1);
      }
    }
  }
  public send(channel: any, message: any) {
    if (Array.isArray(this.sendListeners[channel])) {
      this.sendListeners[channel].forEach((listener) => listener(channel, message));
    }
  }

  public onSend(channel: any, listener: UntypedListener) {
    if (!this.sendListeners[channel]) {
      this.sendListeners[channel] = [];
    }
    this.sendListeners[channel].push(listener);
  }

  public offSend(channel: any, listener: UntypedListener) {
    if (this.sendListeners[channel]) {
      const index = this.sendListeners[channel].indexOf(listener);
      if (index >= 0) {
        this.sendListeners[channel].splice(index, 1);
      }
    }
  }

  public emit(channel: any, message: any) {
    if (Array.isArray(this.listeners[channel])) {
      this.listeners[channel].forEach((listener) => listener(channel, message));
    }
  }
}

const ipcStub = new IpcStub();
(window as unknown as { ipc: IpcStub }).ipc = ipcStub;

interface Ipc<T extends IpcMessages> {
  on<C extends keyof T['frontend']>(channel: C, listener: EventListener<T['frontend'][C]>): void;
  off<C extends keyof T['frontend']>(channel: C, listener: EventListener<T['frontend'][C]>): void;
  send<C extends keyof T['backend']>(channel: C, message: T['backend'][C]): void;
}

export function ipcStubFactory<T extends IpcMessages = IpcMessages>(): Ipc<T> {
  return {
    on: (channel, listener) => ipcStub.onSend(channel, listener),
    off: (channel, listener) => ipcStub.offSend(channel, listener),
    send: (channel, message) => ipcStub.emit(channel, message),
  };
}
