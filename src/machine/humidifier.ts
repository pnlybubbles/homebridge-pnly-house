import { PlatformConfig, Logger } from 'homebridge';
import { commandDevice } from '../api';
import { delay, unreachable } from '../util';

/**
 * min: 30
 * max: 90
 * step: 5
 *
 * null means no humidity control
 */
type Humidity = null | number;
type Volume = 1 | 2 | 3;
type Heater = 0 | 1 | 2 | 3;

export type HumidifierState = {
  active: boolean;
  targetHumidity: number;
  targetHumidityInternal: null | number;
  volume: Volume;
  heater: Heater;
  sleep: boolean;
};

type Props = {
  deviceId: string;
};

type RawActive = 0 | 1;

/**
 * MODERN DECO
 * UV除菌機能付きハイブリッド加湿器
 * jxh003j
 */
export class Humidifier {
  private state: HumidifierState;
  private deviveId: string;
  private log: Logger;
  private config: PlatformConfig;

  constructor(
    state: Partial<HumidifierState>,
    platformConfig: PlatformConfig,
    props: Props,
    { log }: {
    log: Logger;
  },
  ) {
    if (typeof state.active === 'undefined') {
      state.active = INITIAL_STATE.active;
    }
    if (typeof state.targetHumidity === 'undefined') {
      state.targetHumidity = INITIAL_STATE.targetHumidity;
    }
    this.state = state as HumidifierState;
    this.deviveId = props.deviceId;
    this.config = platformConfig;
    this.log = log;
  }

  // 電源

  private async activeTransition(target: boolean) {
    const current = this.state.active;

    if (current === target) {
      return;
    }

    this.state.active = !current;

    try {
      const command = this.config.mapping.power;
      await commandDevice({ token: this.config.token, deviceId: this.deviveId, command, commandType: 'customize', parameter: 'default' });
    } catch (e) {
      this.log.debug(e);
      this.state.active = current;
      return;
    }

    if (this.state.active) {
      this.state.targetHumidityInternal = null;
      await this.setTargetHumidity(this.state.targetHumidity);
    }
  }

  async setActive(value: RawActive) {
    const target = value === 1
      ? true
      : value === 0
        ? false
        : unreachable(value);
    await this.activeTransition(target);
  }

  getActive() {
    return this.state.active ? 1 : 0;
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
  private _abortHumidityTransition?: { resolve: () => void; reject: () => void };

  private async humidityTransition(target: Humidity) {
    if (this.state.targetHumidityInternal === target) {
      return;
    }

    this._requestingHumidityTransition = true;

    if (!this._hotHumidityTransition) {
      // 湿度設定モードに入るための初回リクエスト
      try {
        const command = this.config.mapping.humidity;
        await commandDevice({ token: this.config.token, deviceId: this.deviveId, command, commandType: 'customize', parameter: 'default' });
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
        await commandDevice({ token: this.config.token, deviceId: this.deviveId, command, commandType: 'customize', parameter: 'default' });
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

  getTargetHumidity(): number {
    return this.state.targetHumidity;
  }

  async setTargetHumidity(value: number) {
    this.state.targetHumidity = value;

    if (!this.state.active) {
      return;
    }

    if (this._requestingHumidityTransition) {
      if (this._abortHumidityTransition) {
        this._abortHumidityTransition.reject();
      }
      try {
        await new Promise<void>((resolve, reject) => this._abortHumidityTransition = { resolve, reject });
      } catch {
        return;
      }
    }

    const target = Math.max(Math.min(Math.floor(value / 5) * 5, 90), 30) as Humidity;

    await this.humidityTransition(target);
  }
}

const INITIAL_STATE = {
  active: false,
  targetHumidity: 50,
};
