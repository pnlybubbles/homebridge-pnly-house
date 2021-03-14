import { Logger, PlatformConfig } from "homebridge";
import { AccessoryContext } from "../platform";
import { unreachable } from "../util";
import { HeaterMachine } from "../binder/heater";
import { commandDevice, getDeviceStatus } from "../api";

export interface HeaterState {
  type: "heater";
}

export class Heater implements HeaterMachine {
  private state: HeaterState;
  private deviveId: string;
  private log: Logger;
  private config: PlatformConfig;

  constructor(
    context: AccessoryContext,
    platformConfig: PlatformConfig,
    {
      log,
    }: {
      log: Logger;
    }
  ) {
    this.state =
      context.state?.type === "heater"
        ? context.state
        : (context.state = INITIAL_STATE);
    this.deviveId = context.device?.deviceId ?? unreachable();
    this.config = platformConfig;
    this.log = log;
  }

  async getActive(): Promise<boolean> {
    const data = await getDeviceStatus({
      token: this.config.token,
      deviceId: this.deviveId,
    });
    return data.body.power === "on";
  }

  async setActive(value: boolean): Promise<void> {
    try {
      await commandDevice({
        token: this.config.token,
        deviceId: this.deviveId,
        commandType: "command",
        command: value ? "turnOn" : "turnOff",
        parameter: "default",
      });
    } catch (e) {
      this.log.debug(e);
    }
  }

  async getTargetTemperature(): Promise<number> {
    return await Promise.resolve(25);
  }

  async setTargetTemperature(): Promise<void> {
    return await Promise.resolve();
  }

  async getTemperature(): Promise<number> {
    return await Promise.resolve(22);
  }
}

const INITIAL_STATE: HeaterState = {
  type: "heater",
};
