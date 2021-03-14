import { Formats, Perms, PlatformAccessory, Units } from "homebridge";
import { deriveActive, deriveRawActive, RawActive } from "../common";
import { AccessoryContext, PlatformConstant } from "../platform";

export interface HeaterMachine {
  getTemperature(): Promise<number>;
  getActive(): Promise<boolean>;
  setActive(value: boolean): Promise<void>;
  getTargetTemperature(): Promise<number>;
  setTargetTemperature(value: number): Promise<void>;
}

export default function heaterBinder(
  machine: HeaterMachine,
  accessory: PlatformAccessory<AccessoryContext>,
  { Service, Characteristic }: PlatformConstant
): void {
  accessory
    .getService(Service.AccessoryInformation)
    ?.setCharacteristic(Characteristic.Manufacturer, "pnly Room")
    .setCharacteristic(
      Characteristic.Model,
      accessory.context.device?.deviceName ?? "Unknown"
    )
    .setCharacteristic(
      Characteristic.SerialNumber,
      accessory.context.device?.deviceId ?? `Unknown-${accessory.UUID}`
    );

  const service =
    accessory.getService(Service.HeaterCooler) ||
    accessory.addService(Service.HeaterCooler);

  // 表示名
  service.setCharacteristic(Characteristic.Name, accessory.displayName);

  // 電源
  service
    .getCharacteristic(Characteristic.Active)
    .on(
      "get",
      (cb) =>
        void machine
          .getActive()
          .then((value) => cb(null, deriveRawActive(value)))
    )
    .on(
      "set",
      (value, cb) =>
        void machine
          .setActive(deriveActive(value as RawActive))
          .then(() => cb(null))
    );

  // ヒーター・クーラーの運転状態
  service
    .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
    .on("get", (cb) =>
      cb(null, Characteristic.CurrentHeaterCoolerState.HEATING)
    )
    .setProps({
      validValues: [0, 2],
    });

  // ヒーター・クーラーの設定
  service
    .getCharacteristic(Characteristic.TargetHeaterCoolerState)
    .on("get", (cb) => cb(null, Characteristic.TargetHeaterCoolerState.HEAT))
    .on("set", (_value, cb) => cb(null))
    .setProps({
      validValues: [1],
    });

  // ヒーター・クーラーの設定
  service
    .getCharacteristic(Characteristic.HeatingThresholdTemperature)
    .on(
      "get",
      (cb) =>
        void machine.getTargetTemperature().then((value) => cb(null, value))
    )
    .on(
      "set",
      (value, cb) =>
        void machine.setTargetTemperature(value as number).then(() => cb(null))
    )
    .setProps({
      format: Formats.FLOAT,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.EVENTS],
      maxValue: 25,
      minValue: 0,
      minStep: 0.1,
      unit: Units.CELSIUS,
    });

  // 現在の温度
  service
    .getCharacteristic(Characteristic.CurrentTemperature)
    .on(
      "get",
      (cb) => void machine.getTemperature().then((value) => cb(null, value))
    );
}
