export type ImageRotation = 0 | 90 | 180 | 270;

export type FurnitureBox = [left: number, top: number, width: number, height: number];

export type FurnitureMatch = {
  kind: string;
  title: string;
  score: number;
  box: FurnitureBox;
};

export type LiveFrame = {
  data: ImageData["data"];
  width: number;
  height: number;
  rotation: ImageRotation;
};

export type DetectionResponse = FurnitureMatch[] | null;
