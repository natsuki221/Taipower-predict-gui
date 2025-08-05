export interface TaipowerRawUnit {
  機組類型: string;
  機組名稱: string;
  "裝置容量(MW)": string;
  "淨發電量(MW)": string;
  "淨發電量/裝置容量比(%)": string;
  備註: string;
}

export interface TaipowerRawData {
  DateTime: string;
  aaData: TaipowerRawUnit[];
}

export interface UnitData {
  unitType: string;
  unitName: string;
  installedCapacityMW: number | null;
  netGenerationMW: number | null;
  note: string;
}

export interface PowerGenerationSnapshot {
  DateTime: Date;
  metadata: {
    source: string;
  };
  units: UnitData[];
}
