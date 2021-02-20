import 'homebridge';

declare module 'homebridge' {
  interface PlatformConfig {
    token: string;
    mapping: {
      power: string;
      volume: string;
      heater: string;
      humidity: string;
      sleep: string;
    };
  }
}
