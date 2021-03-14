import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from "homebridge";

import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";
import { Device, getDevices } from "./api";
import { Humidifier, HumidifierState } from "./machine/humidifier";
import humidifierBinder from "./binder/humidifier";

export interface PlatformConstant {
  Service: typeof Service;
  Characteristic: typeof Characteristic;
}

export type AccessoryContext = {
  type: "humidifier";
  device?: Device;
  state?: HumidifierState;
};

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class PnlyRoomPlatform
  implements DynamicPlatformPlugin, PlatformConstant {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.log.debug("Finished initializing platform:", this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on("didFinishLaunching", () => {
      log.debug("Executed didFinishLaunching callback");
      // run the method to discover / register your devices as accessories
      void this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info("Loading accessory from cache:", accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices(): Promise<void> {
    const token = this.config.token;

    const response = await getDevices({ token });
    const devices = response.body.infraredRemoteList;

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of devices) {
      if (/加湿器|humidifier/i.test(device.deviceName)) {
        const accessory = this.getAccessory(device);
        accessory.context.type = "humidifier";
        const machine = new Humidifier(accessory.context, this.config, this);
        humidifierBinder(machine, accessory, this);
      }
    }
  }

  getAccessory(device: Device): PlatformAccessory<AccessoryContext> {
    const uuid = this.api.hap.uuid.generate(device.deviceId);

    const existingAccessory = this.accessories.find(
      (accessory) => accessory.UUID === uuid
    );

    if (existingAccessory) {
      this.log.info(
        "Restoring existing accessory from cache:",
        existingAccessory.displayName
      );

      return existingAccessory as PlatformAccessory<AccessoryContext>;
    }

    this.log.info("Adding new accessory:", device.deviceName);

    const accessory = new this.api.platformAccessory<AccessoryContext>(
      device.deviceName,
      uuid
    );

    accessory.context.device = device;

    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      accessory,
    ]);

    return accessory;
  }
}
