import 'homebridge';

declare module 'homebridge' {
  interface PlatformConfig {
    token: string;
  }
}
