export interface Series {
  x: (number | string)[];
  y: (number | string)[];
  x_label: string;
  y_label: string;
  kind: "profile" | "timeseries";
}

export interface ChatResponse {
  question: string;
  language: string;
  engine: "llm" | "fallback";
  sql: string;
  answer: string;
  chart_kind: "profile" | "timeseries" | "map" | "table";
  columns: string[];
  rows: unknown[][];
  row_count: number;
  series: Series | null;
  geojson: GeoJSON.FeatureCollection;
  float_ids: number[];
  suggestions: string[];
}

export interface ChatMessage {
  role: "user" | "assistant" | "error";
  text: string;
  response?: ChatResponse;
  time?: string;
}
