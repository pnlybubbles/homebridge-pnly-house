import 'homebridge';

declare module 'homebridge' {
  interface PlatformConfig {
    token: string;
    mapping: {
      on: string;
      off: string;
    };
  }
}
