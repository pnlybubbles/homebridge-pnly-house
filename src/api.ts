import axios, { AxiosRequestConfig } from "axios";

const SWITCHBOT_API_ENDPOINT = "https://api.switch-bot.com/v1.0";

type Response<Body> = {
  statusCode: number;
  body: Body;
  message: string;
};

export type Device = {
  deviceId: string;
  deviceName: string;
  remoteType: "Hub mini" | "Plug" | "Others";
  hubDeviceId: string;
};

type Devices = {
  deviceList: Device[];
  infraredRemoteList: Device[];
};

type RequestConfig = {
  token: string;
};

function requestConfig({ token }: RequestConfig): AxiosRequestConfig {
  return {
    headers: {
      Authorization: token,
    },
  };
}

function nextTick<T>(value: T) {
  return new Promise<T>((resolve) => {
    process.nextTick(() => resolve(value));
  });
}

export function getDevices({
  token,
}: RequestConfig): Promise<Response<Devices>> {
  if (process.env.NODE_ENV === "development") {
    return nextTick<Response<Devices>>(
      JSON.parse(
        // eslint-disable-next-line max-len
        '{"statusCode":100,"body":{"deviceList":[{"deviceId":"483FDA0AFD5D","deviceName":"オイルヒーター","deviceType":"Plug","enableCloudService":true,"hubDeviceId":"000000000000"},{"deviceId":"F3709208082A","deviceName":"Hub Mini","deviceType":"Hub Mini","hubDeviceId":"000000000000"}],"infraredRemoteList":[{"deviceId":"02-202102111506-97603093","deviceName":"加湿器","remoteType":"Others","hubDeviceId":"F3709208082A"}]},"message":"success"}'
      )
    );
  }
  return axios
    .get<Response<Devices>>(
      `${SWITCHBOT_API_ENDPOINT}/devices`,
      requestConfig({ token })
    )
    .then((v) => v.data);
}

type CommandProps =
  // Others
  {
    command: string;
    deviceId: string;
    parameter: "default";
    commandType: "customize";
  };
// TODO

export function commandDevice({
  token,
  deviceId,
  command,
  parameter,
  commandType,
}: RequestConfig & CommandProps): Promise<Response<Record<string, never>>> {
  return axios
    .post<Response<Record<string, never>>>(
      `${SWITCHBOT_API_ENDPOINT}/devices/${deviceId}/commands`,
      {
        command,
        parameter,
        commandType,
      },
      {
        headers: {
          Authorization: token,
        },
      }
    )
    .then((v) => v.data);
}

type StatusProps = {
  deviceId: string;
};

type StatusData = {
  deviceId: string;
  hubDeviceId: string;
} & {
  deviceType: "Plug";
  power: string;
};

export function getDeviceStatus({
  token,
  deviceId,
}: RequestConfig & StatusProps): Promise<Response<StatusData>> {
  return axios
    .get<Response<StatusData>>(
      `${SWITCHBOT_API_ENDPOINT}/devices/${deviceId}/status`,
      requestConfig({ token })
    )
    .then((v) => v.data);
}
