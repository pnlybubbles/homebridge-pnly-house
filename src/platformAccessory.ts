import { Service, PlatformAccessory, Units, Perms, Formats } from 'homebridge';
import { Device } from './api';

import { SwitchBotCustomHumidifierPlatform } from './platform';
import { Humidifier, HumidifierState } from './machine/humidifier';

export type AccessoryContext = {
  device?: Device;
  state?: HumidifierState;
};

export class CustomHumidifier {
  private service: Service;

  private humidifier: Humidifier;

  constructor(
    private readonly platform: SwitchBotCustomHumidifierPlatform,
    private readonly accessory: PlatformAccessory<AccessoryContext>,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Switchbot Custom Humidifier')
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device?.deviceName ?? 'Unknown')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.device?.deviceId ?? `Unknown-${this.accessory.UUID}`,
      );

    this.service = this.accessory.getService(this.platform.Service.HumidifierDehumidifier)
      || this.accessory.addService(this.platform.Service.HumidifierDehumidifier);

    // 表示名
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    // 現在の湿度
    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .on('get', this.handleCurrentRelativeHumidityGet.bind(this));

    // 目的の湿度
    this.service.getCharacteristic(this.platform.Characteristic.RelativeHumidityHumidifierThreshold)
      .on('get', this.handleRelativeHumidityHumidifierThresholdGet.bind(this))
      .on('set', this.handleRelativeHumidityHumidifierThresholdSet.bind(this))
      .setProps({
        format: Formats.FLOAT,
        perms: [
          Perms.PAIRED_READ,
          Perms.PAIRED_WRITE,
          Perms.EVENTS,
        ],
        maxValue: 100,
        minValue: 0,
        minStep: 1,
        unit: Units.PERCENTAGE,
      });

    // 加湿器・除湿器の運転状態
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState)
      .on('get', this.handleCurrentHumidifierDehumidifierStateGet.bind(this))
      .setProps({
        validValues: [0, 2],
      });

    // 加湿器・除湿器の設定
    this.service.getCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState)
      .on('get', this.handleTargetHumidifierDehumidifierStateGet.bind(this))
      .on('set', this.handleTargetHumidifierDehumidifierStateSet.bind(this))
      .setProps({
        validValues: [1],
      });

    // 電源
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('get', this.handleActiveGet.bind(this))
      .on('set', this.handleActiveSet.bind(this));


    const deviceId = this.accessory.context.device?.deviceId;
    if (deviceId === undefined) {
      this.platform.log.error('device not found');
      throw new Error('fatal error');
    }

    this.humidifier = new Humidifier(this.accessory.context.state ?? {}, this.platform.config, { deviceId }, this.platform);
  }

  handleCurrentRelativeHumidityGet(callback) {
    this.platform.log.debug('Triggered GET CurrentRelativeHumidity');

    // TODO: 湿度をBME280から取得する
    const currentValue = 1;

    callback(null, currentValue);
  }

  handleRelativeHumidityHumidifierThresholdGet(callback) {
    this.platform.log.debug('Triggered GET RelativeHumidityHumidifierThreshold');

    callback(null, this.humidifier.getTargetHumidity());
  }

  handleRelativeHumidityHumidifierThresholdSet(value, callback) {
    this.platform.log.debug('Triggered SET RelativeHumidityHumidifierThreshold', value);

    this.humidifier.setTargetHumidity(value);

    callback(null);
  }

  handleCurrentHumidifierDehumidifierStateGet(callback) {
    this.platform.log.debug('Triggered GET CurrentHumidifierDehumidifierState');

    // TODO: IDLE判定
    callback(null, this.platform.Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING);
  }

  handleTargetHumidifierDehumidifierStateGet(callback) {
    this.platform.log.debug('Triggered GET TargetHumidifierDehumidifierState');

    // 加湿器にしかならない
    callback(null, this.platform.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER);
  }

  handleTargetHumidifierDehumidifierStateSet(value, callback) {
    this.platform.log.debug('Triggered SET TargetHumidifierDehumidifierState:', value);

    // 加湿器にしかならない
    callback(null);
  }

  handleActiveGet(callback) {
    this.platform.log.debug('Triggered GET Active');

    callback(null, this.humidifier.getActive());
  }

  async handleActiveSet(value, callback) {
    this.platform.log.debug('Triggered SET Active:', value);

    await this.humidifier.setActive(value);

    callback(null);
  }
}
