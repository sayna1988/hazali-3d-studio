export interface SettingsModel {

  id?: number;

  printerNaam: string;

  stroomPrijs: number;

  printerVermogen: number;

  btw: number;

  verpakking: number;

  onderhoud: number;

  platform: string;

  platformKosten: number;

  printerIp?: string;

  printerRemoteUrl?: string;

  printerCameraUrl?: string;

  printerDeviceToken?: string;

}
