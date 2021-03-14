import { Formats, Perms, PlatformAccessory, Units } from "homebridge";
import { RawActive } from "../machine/humidifier";
import { PlatformConstant, AccessoryContext } from "../platform";
import { unreachable } from "../util";

export interface HumidifierMachine {
  getHumidity(): Promise<number>;
  getActive(): Promise<boolean>;
  setActive(value: boolean): Promise<void>;
  getTargetHumidity(): Promise<number>;
  setTargetHumidity(value: number): Promise<void>;
}

export default function humidifierBinder(
  machine: HumidifierMachine,
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
    accessory.getService(Service.HumidifierDehumidifier) ||
    accessory.addService(Service.HumidifierDehumidifier);

  // 表示名
  service.setCharacteristic(Characteristic.Name, accessory.displayName);

  // 現在の湿度
  service
    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
    .on(
      "get",
      (cb) => void machine.getHumidity().then((value) => cb(null, value))
    );

  // 目的の湿度
  service
    .getCharacteristic(Characteristic.RelativeHumidityHumidifierThreshold)
    .on(
      "get",
      (cb) => void machine.getTargetHumidity().then((value) => cb(null, value))
    )
    .on(
      "set",
      (value, cb) =>
        void machine.setTargetHumidity(value as number).then(() => cb(null))
    )
    .setProps({
      format: Formats.FLOAT,
      perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.EVENTS],
      maxValue: 100,
      minValue: 0,
      minStep: 1,
      unit: Units.PERCENTAGE,
    });

  // 加湿器・除湿器の運転状態
  service
    .getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
    .on("get", (cb) =>
      cb(null, Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING)
    )
    .setProps({
      validValues: [0, 2],
    });

  // 加湿器・除湿器の設定
  service
    .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
    .on("get", (cb) =>
      cb(null, Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER)
    )
    .on("set", (_value, cb) => cb(null))
    .setProps({
      validValues: [1],
    });

  // 電源
  service
    .getCharacteristic(Characteristic.Active)
    .on(
      "get",
      (cb) => void machine.getActive().then((value) => cb(null, value))
    )
    .on("set", (value, cb) => {
      const rawActive = value as RawActive;
      void machine
        .setActive(
          rawActive === 1
            ? true
            : rawActive === 0
            ? false
            : unreachable(rawActive)
        )
        .then(() => cb(null));
    });
}
