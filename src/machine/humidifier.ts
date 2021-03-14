import { PlatformConfig, Logger } from "homebridge";
import { commandDevice } from "../api";
import { delay, unreachable } from "../util";
import { HumidifierMachine } from "../binder/humidifier";
import { AccessoryContext } from "../platform";

/**
 * min: 30
 * max: 90
 * step: 5
 *
 * null means no humidity control
 */
type Humidity = null | number;

export type HumidifierState = {
  type: "humidifier";
  active: boolean;
  targetHumidity: number;
  targetHumidityInternal: null | number;
};

/**
 * MODERN DECO
 * UV除菌機能付きハイブリッド加湿器
 * jxh003j
 */
export class Humidifier implements HumidifierMachine {
  private state: HumidifierState;
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
      context.state?.type === "humidifier"
        ? context.state
        : (context.state = INITIAL_STATE);
    this.deviveId = context.device?.deviceId ?? unreachable();
    this.config = platformConfig;
    this.log = log;
  }

  // 電源

  async setActive(target: boolean): Promise<void> {
    const current = this.state.active;

    if (current === target) {
      return;
    }

    this.state.active = !current;

    try {
      const command = this.config.mapping.power;
      await commandDevice({
        token: this.config.token,
        deviceId: this.deviveId,
        command,
        commandType: "customize",
        parameter: "default",
      });
    } catch (e) {
      this.log.debug(e);
      this.state.active = current;
      return;
    }

    if (this.state.active) {
      this.state.targetHumidityInternal = null;
      // 湿度設定は非同期
      void this.setTargetHumidity(this.state.targetHumidity);
    }
  }

  getActive(): Promise<boolean> {
    return Promise.resolve(this.state.active);
  }

  // 湿度設定

  /**
   * 湿度設定に入っている場合true
   */
  private _hotHumidityTransition = false;
  /**
   * 湿度設定用の重要なリクエスト中の場合true (リクエストの間隔が短くなりすぎないように調節するため)
   */
  private _requestingHumidityTransition = false;
  /**
   * 湿度設定用の重要なリクエスト中、きりの良いタイミングでリクエストを中止するための関数
   * 中止した場合はresolveが呼ばれる
   */
  private _abortHumidityTransition?: {
    resolve: () => void;
    reject: () => void;
  };

  private async humidityTransition(target: Humidity) {
    if (this.state.targetHumidityInternal === target) {
      return;
    }

    this._requestingHumidityTransition = true;

    if (!this._hotHumidityTransition) {
      // 湿度設定モードに入るための初回リクエスト
      try {
        const command = this.config.mapping.humidity;
        await commandDevice({
          token: this.config.token,
          deviceId: this.deviveId,
          command,
          commandType: "customize",
          parameter: "default",
        });
      } catch (e) {
        this.log.debug(e);
        return;
      }

      this._hotHumidityTransition = true;
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const current = this.state.targetHumidityInternal;

      if (this._abortHumidityTransition) {
        this._requestingHumidityTransition = false;
        this._abortHumidityTransition.resolve();
        this._abortHumidityTransition = undefined;
        return;
      }

      if (current === target) {
        break;
      }

      if (this.state.targetHumidityInternal === null) {
        this.state.targetHumidityInternal = 30;
      } else if (this.state.targetHumidityInternal < 90) {
        this.state.targetHumidityInternal += 5;
      } else {
        this.state.targetHumidityInternal = null;
      }

      try {
        const command = this.config.mapping.humidity;
        await commandDevice({
          token: this.config.token,
          deviceId: this.deviveId,
          command,
          commandType: "customize",
          parameter: "default",
        });
      } catch (e) {
        this.log.debug(e);
        this.state.targetHumidityInternal = current;
      }
    }

    this._requestingHumidityTransition = false;
    // 湿度設定モードから出るための待機
    await delay(3);
    this._hotHumidityTransition = false;
  }

  getTargetHumidity(): Promise<number> {
    return Promise.resolve(this.state.targetHumidity);
  }

  async setTargetHumidity(value: number): Promise<void> {
    this.state.targetHumidity = value;

    if (!this.state.active) {
      return;
    }

    if (this._requestingHumidityTransition) {
      if (this._abortHumidityTransition) {
        this._abortHumidityTransition.reject();
      }
      try {
        await new Promise<void>(
          (resolve, reject) =>
            (this._abortHumidityTransition = { resolve, reject })
        );
      } catch {
        return;
      }
    }

    const target = Math.max(
      Math.min(Math.floor(value / 5) * 5, 90),
      30
    ) as Humidity;

    void this.humidityTransition(target);
  }

  async getHumidity(): Promise<number> {
    return Promise.resolve(1);
  }
}

const INITIAL_STATE: HumidifierState = {
  type: "humidifier",
  active: false,
  targetHumidity: 50,
  targetHumidityInternal: null,
};
