export type TowerType = "RIG" | "PULLING" | "WORKOVER";
export type TowerStatus = "operativo" | "atencion" | "desconectado";
export interface Camera {
  id: string;
  name: string;
  kind: "demo" | "image" | "hls";
  url: string;
  status: "online" | "offline";
}
export interface Parameter {
  key: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  history: number[];
}
export interface DroneInspectionSource {
  videoId: string;
  url: string;
  updatedAt: string;
}
export interface Tower {
  id: string;
  name: string;
  type: TowerType;
  status: TowerStatus;
  location: string;
  operator: string;
  well: string;
  lat: number;
  lng: number;
  image: string;
  updatedAt: string;
  cameras: Camera[];
  parameters: Parameter[];
  demo: boolean;
  droneInspection?: DroneInspectionSource | null;
}
export interface Anomaly {
  id: string;
  towerId: string;
  title: string;
  description: string;
  severity: "critica" | "media" | "baja";
  status: "pendiente" | "revisada" | "resuelta";
  timestamp: string;
  image: string;
  camera: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "viewer";
}
