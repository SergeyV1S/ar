import type { AxiosRequestConfig } from "axios";

export type ApiRequest<Params> = {
  params: Params;
  config?: AxiosRequestConfig;
};
