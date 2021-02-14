import { Service, PlatformAccessory } from 'homebridge';
import { commandDevice, Device } from './api';

import { SwitchBotCustomHumidifierPlatform } from './platform';
import { unreachable } from './util';

type State = {
  active: boolean;
};

export type AccessoryContext = {
  device?: Device;
  state?: State;
};

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class CustomHumidifier {
  private service: Service;

  constructor(
    private readonly platform: SwitchBotCustomHumidifierPlatform,
    private readonly accessory: PlatformAccessory<AccessoryContext>,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Switchbot Custom Humidifier')
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device?.deviceName ?? 'Unknown')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.device?.deviceId ?? `Unknown-${this.accessory.UUID}`,
      );

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.HumidifierDehumidifier)
      || this.accessory.addService(this.platform.Service.HumidifierDehumidifier);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .on('get', this.handleCurrentRelativeHumidityGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState)
      .on('get', this.handleCurrentHumidifierDehumidifierStateGet.bind(this))
      .setProps({
        validValues: [0, 2],
      });

    this.service.getCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState)
      .on('get', this.handleTargetHumidifierDehumidifierStateGet.bind(this))
      .on('set', this.handleTargetHumidifierDehumidifierStateSet.bind(this))
      .setProps({
        validValues: [1],
      });

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('get', this.handleActiveGet.bind(this))
      .on('set', this.handleActiveSet.bind(this));
  }

  initialState(): State {
    return {
      active: false,
    };
  }

  get active() {
    return this.accessory.context.state?.active ?? false;
  }

  set active(value: boolean) {
    if (this.accessory.context.state === undefined) {
      this.accessory.context.state = this.initialState();
      return;
    }
    this.accessory.context.state.active = value;
  }

  /**
   * Handle requests to get the current value of the "Current Relative Humidity" characteristic
   */
  handleCurrentRelativeHumidityGet(callback) {
    this.platform.log.debug('Triggered GET CurrentRelativeHumidity');

    // set this to a valid value for CurrentRelativeHumidity
    const currentValue = 1;

    callback(null, currentValue);
  }


  /**
   * Handle requests to get the current value of the "Current Humidifier Dehumidifier State" characteristic
   */
  handleCurrentHumidifierDehumidifierStateGet(callback) {
    this.platform.log.debug('Triggered GET CurrentHumidifierDehumidifierState');

    // TODO: IDLE判定
    callback(null, this.platform.Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING);
  }


  /**
   * Handle requests to get the current value of the "Target Humidifier Dehumidifier State" characteristic
   */
  handleTargetHumidifierDehumidifierStateGet(callback) {
    this.platform.log.debug('Triggered GET TargetHumidifierDehumidifierState');

    // 加湿器にしかならない
    callback(null, this.platform.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER);
  }

  /**
   * Handle requests to set the "Target Humidifier Dehumidifier State" characteristic
   */
  handleTargetHumidifierDehumidifierStateSet(value, callback) {
    this.platform.log.debug('Triggered SET TargetHumidifierDehumidifierState:', value);

    // 加湿器にしかならない
    callback(null);
  }

  /**
   * Handle requests to get the current value of the "Active" characteristic
   */
  handleActiveGet(callback) {
    this.platform.log.debug('Triggered GET Active');

    callback(null, this.deriveActive(this.active));
  }

  /**
   * Handle requests to set the "Active" characteristic
   */
  async handleActiveSet(value, callback) {
    this.platform.log.debug('Triggered SET Active:', value);

    const token = this.platform.config.token;
    const deviceId = this.accessory.context.device?.deviceId;

    if (deviceId === undefined) {
      return;
    }

    const prev = this.active;
    const next = this.reverseDeriveActive(value);
    if (prev === next) {
      return;
    }

    this.active = next;

    try {
      const command = next ? this.platform.config.mapping.on : this.platform.config.mapping.off;
      await commandDevice({ token, deviceId, command, commandType: 'customize', parameter: 'default' });
      callback(null, this.deriveActive(next));
    } catch (e) {
      this.platform.log.error(e);
      this.active = prev;
    }
  }

  deriveActive(active: boolean) {
    return active ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  reverseDeriveActive(value: 0 | 1) {
    return value === this.platform.Characteristic.Active.ACTIVE
      ? true
      : value === this.platform.Characteristic.Active.INACTIVE
        ? false
        : unreachable(value);
  }
}
